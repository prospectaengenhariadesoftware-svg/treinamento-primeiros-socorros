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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const expected = process.env.ADMIN_PIN;
      if (expected && req.headers['x-admin-pin'] !== expected) {
        return res.status(401).json({ error: 'PIN administrativo inválido' });
      }
      const { client: supabase } = getSupabase({ requireService: true });
      const { data, error } = await supabase.from('presencas_primeiros_socorros').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
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
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};
