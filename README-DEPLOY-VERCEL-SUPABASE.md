# Treinamento Primeiros Socorros — Vercel + Supabase

Links depois do deploy:

- `/treinamento.html` — página do instrutor com slides.
- `/presenca.html` — link público para participantes preencherem Nome, CPF e Assinatura.
- `/admin.html` — página administrativa para ver lista, excluir participante, configurar data/horário/local, acompanhar avaliações e gerar PDF.
- `/avaliacao.html` — avaliação de aprendizagem com 3 tentativas, nota mínima de 70% e certificado de participação para aprovados.

## Supabase

1. Crie um projeto Supabase.
2. Abra SQL Editor.
3. Rode o arquivo `supabase-schema.sql`.

## Variáveis na Vercel

Configure em Project Settings > Environment Variables:

- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` preferencialmente
- `ADMIN_PIN`
- `AVALIACAO_GABARITO` com as 20 respostas separadas por vírgula. Não publique esse valor em páginas públicas.

A integração Vercel/Supabase às vezes cria `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em vez dos nomes acima. A API aceita esses nomes para cadastro, mas a página `/admin.html` precisa de `SUPABASE_SERVICE_ROLE_KEY` para listar os participantes com segurança.

Não exponha a service role key em página pública.
