-- Keep sender-scoped video greeting queries efficient as games grow.
create index if not exists video_greetings_giver_id_idx
  on public.video_greetings (giver_id);