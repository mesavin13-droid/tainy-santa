-- Тайный Санта: initial schema. Review and apply in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.game_status as enum ('registration','locked','drawn','completed');
create type public.gift_status as enum ('pending','prepared','delivered');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default encode(gen_random_bytes(8), 'hex'),
  name text not null,
  company_name text not null,
  budget integer not null check (budget > 0),
  exchange_date date,
  registration_deadline date,
  rules text not null default '',
  status public.game_status not null default 'registration',
  organizer_token_hash text not null,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  department text not null default '' check (char_length(department) <= 80),
  wishlist text not null default '' check (char_length(wishlist) <= 1000),
  access_token_hash text not null,
  gift_state public.gift_status not null default 'pending',
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, id)
);

create table public.restrictions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  giver_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  check (giver_id <> receiver_id),
  unique (game_id, giver_id, receiver_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  giver_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, giver_id),
  unique (game_id, receiver_id),
  check (giver_id <> receiver_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  sender_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index participants_game_idx on public.participants(game_id);
create index assignments_game_idx on public.assignments(game_id);
create index messages_receiver_idx on public.messages(receiver_id, created_at desc);

alter table public.games enable row level security;
alter table public.participants enable row level security;
alter table public.restrictions enable row level security;
alter table public.assignments enable row level security;
alter table public.messages enable row level security;

-- No public policies by design. Access is mediated by server routes with hashed tokens.