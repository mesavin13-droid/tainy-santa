-- Remove a participant only while registration is open. Lock the game row
-- in the same transaction as deletion to prevent races with the draw RPC.
create or replace function public.remove_santa_participant(
  p_game_id uuid,
  p_organizer_token_hash text,
  p_participant_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.games%rowtype;
  v_deleted integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.organizer_token_hash is distinct from p_organizer_token_hash then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_game.status <> 'registration' then
    raise exception 'participants_locked';
  end if;
  delete from public.participants
    where game_id = p_game_id and id = p_participant_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.remove_santa_participant(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.remove_santa_participant(uuid, text, uuid) to service_role;
