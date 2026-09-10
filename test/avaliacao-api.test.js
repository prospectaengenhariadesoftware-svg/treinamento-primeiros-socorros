const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');
const path = require('node:path');

const apiPath = path.resolve(__dirname, '../api/avaliacao.js');

function clearEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.ADMIN_PIN;
  delete process.env.AVALIACAO_GABARITO;
}

function loadHandlerWithSupabaseStub(stubFactory) {
  delete require.cache[apiPath];
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@supabase/supabase-js') {
      return { createClient: stubFactory };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(apiPath);
  } finally {
    Module._load = originalLoad;
  }
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeSupabaseStub() {
  return () => ({
    from(table) {
      if (table === 'avaliacoes_primeiros_socorros') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return Promise.resolve({ data: [], error: null });
          },
          insert() {
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'avaliacao-teste', created_at: '2026-09-10T09:00:00.000Z' },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'treinamento_config') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: {}, error: null });
          },
        };
      }
      throw new Error(`Tabela inesperada no teste: ${table}`);
    },
  });
}

test('GET administrativo falha fechado por ADMIN_PIN ausente antes de exigir Supabase', async () => {
  clearEnv();
  const handler = loadHandlerWithSupabaseStub(() => {
    throw new Error('Supabase não deveria ser inicializado sem PIN administrativo');
  });
  const res = makeRes();

  await handler({ method: 'GET', headers: {}, body: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /ADMIN_PIN não configurado/);
});

test('DELETE administrativo falha fechado por ADMIN_PIN ausente antes de exigir Supabase', async () => {
  clearEnv();
  const handler = loadHandlerWithSupabaseStub(() => {
    throw new Error('Supabase não deveria ser inicializado sem PIN administrativo');
  });
  const res = makeRes();

  await handler({ method: 'DELETE', headers: {}, body: { id: 'avaliacao-teste' } }, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /ADMIN_PIN não configurado/);
});

test('POST de avaliação não usa gabarito codificado quando AVALIACAO_GABARITO está ausente', async () => {
  clearEnv();
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role';
  const handler = loadHandlerWithSupabaseStub(makeSupabaseStub());
  const res = makeRes();
  const respostas = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [String(index + 1), 'B']));

  await handler({
    method: 'POST',
    headers: {},
    body: { nome: 'Participante Teste', cpf: '12345678901', respostas },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /AVALIACAO_GABARITO/);
});
