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

-- A API da Vercel usa SUPABASE_SERVICE_ROLE_KEY no servidor.
-- Por isso não é necessário liberar insert/select público via anon key.
-- Mantenha sem policies públicas para proteger CPF e assinaturas.
