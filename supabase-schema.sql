-- Execute este SQL no Supabase SQL Editor (https://supabase.com/dashboard)

-- Tabela de votações
create table polls (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  is_open boolean default true,
  created_at timestamptz default now()
);

-- Tabela de opções
create table poll_options (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references polls(id) on delete cascade not null,
  text text not null
);

-- Tabela de votos
create table votes (
  id uuid default gen_random_uuid() primary key,
  option_id uuid references poll_options(id) on delete cascade not null,
  poll_id uuid references polls(id) on delete cascade not null,
  voter_id text not null,
  created_at timestamptz default now(),
  unique(poll_id, voter_id)
);

-- Índices
create index idx_votes_option_id on votes(option_id);
create index idx_votes_poll_id on votes(poll_id);
create index idx_polls_slug on polls(slug);

-- Habilitar Row Level Security
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table votes enable row level security;

-- Políticas: qualquer um pode ler e criar (app público)
create policy "Polls are viewable by everyone" on polls for select using (true);
create policy "Anyone can create polls" on polls for insert with check (true);
create policy "Anyone can update polls" on polls for update using (true);

create policy "Options are viewable by everyone" on poll_options for select using (true);
create policy "Anyone can create options" on poll_options for insert with check (true);

create policy "Votes are viewable by everyone" on votes for select using (true);
create policy "Anyone can vote" on votes for insert with check (true);

-- Habilitar Realtime na tabela votes
alter publication supabase_realtime add table votes;
