-- Supabase SQL — Lista de presença Primeiros Socorros
-- Rode no Supabase: SQL Editor > New query > Run

create table if not exists public.presencas_primeiros_socorros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null unique,
  assinatura text not null,
  created_at timestamptz not null default now()
);

alter table public.presencas_primeiros_socorros enable row level security;

-- A API da Vercel deve usar SUPABASE_SERVICE_ROLE_KEY no servidor para cadastrar e listar.
-- Se a integração Vercel/Supabase fornecer apenas anon key, esta policy permite somente cadastro público.
-- Não há policy de SELECT público: CPF e assinaturas continuam protegidos contra leitura anônima.
drop policy if exists "Permitir cadastro publico de presenca" on public.presencas_primeiros_socorros;
create policy "Permitir cadastro publico de presenca"
  on public.presencas_primeiros_socorros
  for insert
  to anon
  with check (true);
