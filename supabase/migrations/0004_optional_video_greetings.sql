create table public.video_greetings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  giver_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('video/mp4','video/webm','video/quicktime')),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, giver_id),
  check (giver_id <> receiver_id)
);
create index video_greetings_receiver_idx on public.video_greetings(receiver_id, uploaded_at);
alter table public.video_greetings enable row level security;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('santa-video-greetings', 'santa-video-greetings', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];
revoke all on public.video_greetings from anon, authenticated;