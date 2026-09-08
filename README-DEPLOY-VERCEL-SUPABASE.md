# Treinamento Primeiros Socorros — Vercel + Supabase

Links depois do deploy:

- `/treinamento.html` — página do instrutor com slides.
- `/presenca.html` — link público para participantes preencherem Nome, CPF e Assinatura.
- `/admin.html` — página administrativa para ver lista, baixar CSV/JSON e gerar PDF.

## Supabase

1. Crie um projeto Supabase.
2. Abra SQL Editor.
3. Rode o arquivo `supabase-schema.sql`.

## Variáveis na Vercel

Configure em Project Settings > Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`

Não exponha a service role key em página pública.
