-- Atualização Supabase — configuração do treinamento + avaliação
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run

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

create table if not exists public.avaliacoes_primeiros_socorros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  tentativa integer not null check (tentativa between 1 and 3),
  respostas jsonb not null,
  acertos integer not null,
  total integer not null default 20,
  percentual numeric(5,2) not null,
  aprovado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists avaliacoes_primeiros_socorros_cpf_idx
  on public.avaliacoes_primeiros_socorros (cpf, tentativa);

alter table public.treinamento_config enable row level security;
alter table public.avaliacoes_primeiros_socorros enable row level security;

-- Confirmação visual no SQL Editor
select 'OK - tabelas criadas' as status;
