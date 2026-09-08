const { createClient } = require('@supabase/supabase-js');

const URL_ENV_NAMES = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SECRET_KEY'];
const ANON_KEY_ENV_NAMES = ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return { name, value: String(value).trim() };
  }
  return null;
}

function envDiagnostics() {
  const names = [...URL_ENV_NAMES, ...SERVICE_KEY_ENV_NAMES, ...ANON_KEY_ENV_NAMES, 'ADMIN_PIN'];
  return names.filter((name) => Boolean(process.env[name])).join(', ') || 'nenhuma variável Supabase reconhecida';
}

function getSupabase({ requireService = false } = {}) {
  const url = firstEnv(URL_ENV_NAMES);
  const serviceKey = firstEnv(SERVICE_KEY_ENV_NAMES);
  const anonKey = firstEnv(ANON_KEY_ENV_NAMES);
  const key = serviceKey || (!requireService ? anonKey : null);

  if (!url || !key) {
    const expected = requireService
      ? 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'
      : 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY';
    throw new Error(`${expected} não configurado na Vercel. Variáveis detectadas: ${envDiagnostics()}`);
  }

  return {
    client: createClient(url.value, key.value, { auth: { persistSession: false } }),
    keyType: serviceKey ? 'service_role' : 'anon',
  };
}

function checkAdmin(req) {
  const expected = process.env.ADMIN_PIN;
  if (expected && req.headers['x-admin-pin'] !== expected) {
    return 'PIN administrativo inválido';
  }
  return null;
}

function sanitizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validPayload(body) {
  const nome = String(body.nome || '').trim();
  const cpf = sanitizeCpf(body.cpf);
  const assinatura = String(body.assinatura || '').trim();
  if (nome.length < 5) return ['Nome inválido'];
  if (cpf.replace(/\D/g, '').length !== 11) return ['CPF inválido'];
  if (!assinatura.startsWith('data:image/png;base64,')) return ['Assinatura inválida'];
  if (assinatura.length > 500000) return ['Assinatura muito grande'];
  return [null, { nome, cpf, assinatura }];
}

function cleanConfig(body) {
  return {
    id: true,
    tema: String(body.tema || 'Treinamento de Primeiros Socorros').trim().slice(0, 180),
    instrutor: String(body.instrutor || 'Eng. Armando Luis da Silva Gomes').trim().slice(0, 140),
    data_treinamento: String(body.data_treinamento || '').trim().slice(0, 20) || null,
    horario: String(body.horario || '').trim().slice(0, 80),
    local: String(body.local || '').trim().slice(0, 180),
    empresa: String(body.empresa || '').trim().slice(0, 180),
    observacoes: String(body.observacoes || '').trim().slice(0, 500),
    updated_at: new Date().toISOString(),
  };
}

function defaultConfig() {
  return {
    id: true,
    tema: 'Treinamento de Primeiros Socorros',
    instrutor: 'Eng. Armando Luis da Silva Gomes',
    data_treinamento: null,
    horario: '',
    local: '',
    empresa: '',
    observacoes: '',
  };
}

function isMissingTable(error, tableName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === '42P01' || error?.code === 'PGRST205' || msg.includes(tableName) || msg.includes('schema cache');
}

async function loadConfig(supabase) {
  const { data, error } = await supabase
    .from('treinamento_config')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, 'treinamento_config')) return defaultConfig();
    throw error;
  }
  return data || defaultConfig();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const adminError = checkAdmin(req);
      if (adminError) return res.status(401).json({ error: adminError });

      const { client: supabase } = getSupabase({ requireService: true });
      const [{ data: participantes, error }, configuracao] = await Promise.all([
        supabase.from('presencas_primeiros_socorros').select('*').order('created_at', { ascending: true }),
        loadConfig(supabase),
      ]);
      if (error) throw error;
      return res.status(200).json({ participantes: participantes || [], configuracao });
    }

    if (req.method === 'POST') {
      const [err, item] = validPayload(req.body || {});
      if (err) return res.status(400).json({ error: err });
      const { client: supabase, keyType } = getSupabase({ requireService: false });
      const query = supabase.from('presencas_primeiros_socorros');
      const result = keyType === 'service_role'
        ? await query.upsert(item, { onConflict: 'cpf' }).select('*').single()
        : await query.insert(item);
      if (result.error) throw result.error;
      return res.status(200).json({ ok: true, participante: keyType === 'service_role' ? result.data : null });
    }

    if (req.method === 'PATCH') {
      const adminError = checkAdmin(req);
      if (adminError) return res.status(401).json({ error: adminError });

      const { client: supabase } = getSupabase({ requireService: true });
      const config = cleanConfig(req.body || {});
      const { data, error } = await supabase
        .from('treinamento_config')
        .upsert(config, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, configuracao: data });
    }

    if (req.method === 'DELETE') {
      const adminError = checkAdmin(req);
      if (adminError) return res.status(401).json({ error: adminError });

      const id = String((req.body || {}).id || '').trim();
      if (!id) return res.status(400).json({ error: 'ID do participante não informado' });
      const { client: supabase } = getSupabase({ requireService: true });
      const { error } = await supabase.from('presencas_primeiros_socorros').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};
