-- Trigger functions are not intended to be callable as public RPC endpoints.
revoke all on function public.guard_participant_registration() from public, anon, authenticated;
revoke all on function public.guard_restriction_edit() from public, anon, authenticated;

create index if not exists assignments_giver_idx on public.assignments(giver_id);
create index if not exists assignments_receiver_idx on public.assignments(receiver_id);
create index if not exists messages_game_idx on public.messages(game_id);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists restrictions_giver_idx on public.restrictions(giver_id);
create index if not exists restrictions_receiver_idx on public.restrictions(receiver_id);