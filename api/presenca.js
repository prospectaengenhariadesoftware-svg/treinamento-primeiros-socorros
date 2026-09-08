const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
  return createClient(url, key, { auth: { persistSession: false } });
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
    const supabase = getSupabase();
    if (req.method === 'GET') {
      const expected = process.env.ADMIN_PIN;
      if (expected && req.headers['x-admin-pin'] !== expected) {
        return res.status(401).json({ error: 'PIN administrativo inválido' });
      }
      const { data, error } = await supabase.from('presencas_primeiros_socorros').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const [err, item] = validPayload(req.body || {});
      if (err) return res.status(400).json({ error: err });
      const { data, error } = await supabase
        .from('presencas_primeiros_socorros')
        .upsert(item, { onConflict: 'cpf' })
        .select('*')
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, participante: data });
    }
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};
