const { createClient } = require('@supabase/supabase-js');

const URL_ENV_NAMES = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SECRET_KEY'];
const MIN_PERCENTUAL = 70;
const MAX_TENTATIVAS = 3;
const TOTAL_QUESTOES = 20;

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function getSupabase() {
  const url = firstEnv(URL_ENV_NAMES);
  const key = firstEnv(SERVICE_KEY_ENV_NAMES);
  if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados');
  return createClient(url, key, { auth: { persistSession: false } });
}

function checkAdmin(req) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return 'ADMIN_PIN não configurado na Vercel';
  if (req.headers['x-admin-pin'] !== expected) return 'PIN administrativo inválido';
  return null;
}

function parseAnswerKey(raw) {
  const normalized = String(raw || '').trim().toUpperCase();
  if (!normalized) return null;
  const values = normalized.includes(',') ? normalized.split(',') : normalized.split('');
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length !== TOTAL_QUESTOES || clean.some((v) => !['A', 'B', 'C', 'D'].includes(v))) return null;
  return clean;
}

function answerKey() {
  const fromEnv = parseAnswerKey(process.env.AVALIACAO_GABARITO);
  if (fromEnv) return fromEnv;

  // Fallback server-side para evitar falha operacional se a variável da Vercel
  // não for carregada. Este arquivo roda apenas na API; o frontend público não
  // recebe o gabarito.
  return [66, 67, 66, 66, 67, 66, 67, 66, 66, 67, 67, 66, 67, 67, 67, 66, 66, 66, 66, 67]
    .map((code) => String.fromCharCode(code));
}

function sanitizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function cleanAnswers(respostas) {
  const out = {};
  for (let i = 1; i <= TOTAL_QUESTOES; i += 1) {
    const value = String((respostas || {})[i] || (respostas || {})[String(i)] || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(value)) return null;
    out[String(i)] = value;
  }
  return out;
}

function isMissingTable(error, tableName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === '42P01' || error?.code === 'PGRST205' || msg.includes(tableName) || msg.includes('schema cache');
}

async function loadConfig(supabase) {
  const { data, error } = await supabase.from('treinamento_config').select('*').eq('id', true).maybeSingle();
  if (error) {
    if (isMissingTable(error, 'treinamento_config')) return {};
    throw error;
  }
  return data || {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const adminError = checkAdmin(req);
      if (adminError) return res.status(401).json({ error: adminError });
      const [{ data, error }, configuracao] = await Promise.all([
        supabase
          .from('avaliacoes_primeiros_socorros')
          .select('*')
          .order('created_at', { ascending: false }),
        loadConfig(supabase),
      ]);
      if (error) throw error;
      return res.status(200).json({ avaliacoes: data || [], configuracao });
    }

    if (req.method === 'DELETE') {
      const adminError = checkAdmin(req);
      if (adminError) return res.status(401).json({ error: adminError });
      const id = String((req.body || {}).id || '').trim();
      if (!id) return res.status(400).json({ error: 'ID da avaliação não informado' });
      const { error } = await supabase.from('avaliacoes_primeiros_socorros').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const nome = String((req.body || {}).nome || '').trim();
    const cpf = sanitizeCpf((req.body || {}).cpf);
    const respostas = cleanAnswers((req.body || {}).respostas);
    if (nome.length < 5) return res.status(400).json({ error: 'Nome inválido' });
    if (cpf.replace(/\D/g, '').length !== 11) return res.status(400).json({ error: 'CPF inválido' });
    if (!respostas) return res.status(400).json({ error: 'Todas as questões devem ser respondidas' });

    const { data: anteriores, error: prevError } = await supabase
      .from('avaliacoes_primeiros_socorros')
      .select('id,tentativa,aprovado')
      .eq('cpf', cpf)
      .order('tentativa', { ascending: false });
    if (prevError) throw prevError;

    const tentativas = anteriores || [];
    if (tentativas.some((t) => t.aprovado)) {
      return res.status(409).json({ error: 'Este CPF já foi aprovado. O certificado já está liberado no registro administrativo.' });
    }
    if (tentativas.length >= MAX_TENTATIVAS) {
      return res.status(403).json({ error: 'Tentativas encerradas. Resultado final: reprovado.' });
    }

    const key = answerKey();
    let acertos = 0;
    for (let i = 1; i <= TOTAL_QUESTOES; i += 1) {
      if (respostas[String(i)] === key[i - 1]) acertos += 1;
    }
    const percentual = (acertos / TOTAL_QUESTOES) * 100;
    const aprovado = percentual >= MIN_PERCENTUAL;
    const tentativa = tentativas.length + 1;
    const config = await loadConfig(supabase);

    const { data, error } = await supabase
      .from('avaliacoes_primeiros_socorros')
      .insert({ nome, cpf, tentativa, respostas, acertos, total: TOTAL_QUESTOES, percentual, aprovado })
      .select('id,nome,cpf,tentativa,acertos,total,percentual,aprovado,created_at')
      .single();
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      aprovado,
      tentativa,
      tentativas_restantes: Math.max(0, MAX_TENTATIVAS - tentativa),
      acertos,
      total: TOTAL_QUESTOES,
      percentual,
      certificado: aprovado ? {
        nome,
        cpf,
        tema: config.tema || 'Treinamento de Primeiros Socorros — Nível 1',
        local: config.local || '',
        empresa: config.empresa || '',
        data: config.data_treinamento ? new Date(config.data_treinamento + 'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
        percentual,
        aproveitamento: `${Math.round(percentual)}%`,
        emitido_em: data.created_at ? new Date(data.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
        registro: data.id,
      } : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};
