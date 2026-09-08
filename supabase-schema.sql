-- Supabase SQL — Lista de presença Primeiros Socorros
-- Rode no Supabase: SQL Editor > New query > Run

create table if not exists public.presencas_primeiros_socorros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null unique,
  assinatura text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.treinamento_config (
  id boolean primary key default true,
  tema text not null default 'Treinamento de Primeiros Socorros',
  instrutor text not null default 'Eng. Armando Luis da Silva Gomes',
  data_treinamento date,
  horario text not null default '',
  local text not null default '',
  empresa text not null default '',
  observacoes text not null default '',
  updated_at timestamptz not null default now(),
  constraint treinamento_config_singleton check (id = true)
);

insert into public.treinamento_config (id)
values (true)
on conflict (id) do nothing;

alter table public.presencas_primeiros_socorros enable row level security;
alter table public.treinamento_config enable row level security;

-- A API da Vercel deve usar SUPABASE_SERVICE_ROLE_KEY no servidor para listar,
-- excluir participantes e salvar a configuração do treinamento.
-- Se a integração Vercel/Supabase fornecer apenas anon key, esta policy permite
-- somente cadastro público. Não há SELECT público para CPF e assinaturas.
drop policy if exists "Permitir cadastro publico de presenca" on public.presencas_primeiros_socorros;
create policy "Permitir cadastro publico de presenca"
  on public.presencas_primeiros_socorros
  for insert
  to anon
  with check (true);
