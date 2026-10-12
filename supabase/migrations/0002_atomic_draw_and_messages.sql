-- Atomic draw finalization, anonymous replies, and a registration-vs-draw lock.
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete cascade;
create index if not exists messages_reply_to_idx on public.messages(reply_to_id);

create or replace function public.guard_participant_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = new.game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status <> 'registration' then raise exception 'registration_closed'; end if;
  if v_game.registration_deadline is not null and v_game.registration_deadline < current_date then raise exception 'registration_deadline_passed'; end if;
  return new;
end;
$$;
drop trigger if exists participants_registration_guard on public.participants;
create trigger participants_registration_guard before insert on public.participants for each row execute function public.guard_participant_registration();

create or replace function public.guard_restriction_edit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_game_id uuid; v_status public.game_status;
begin
  v_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  select status into v_status from public.games where id = v_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_status <> 'registration' then raise exception 'restrictions_locked'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists restrictions_edit_guard on public.restrictions;
create trigger restrictions_edit_guard before insert or update or delete on public.restrictions for each row execute function public.guard_restriction_edit();

create or replace function public.finalize_secret_santa_draw(p_game_id uuid, p_organizer_token_hash text, p_expected_participant_ids uuid[], p_pairs jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_game public.games%rowtype; v_current_ids uuid[]; v_expected_ids uuid[]; v_count integer; v_pair_count integer; v_unique_givers integer; v_unique_receivers integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.organizer_token_hash is distinct from p_organizer_token_hash then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_game.status <> 'registration' then raise exception 'draw_already_done'; end if;
  select count(*), array_agg(id order by id) into v_count, v_current_ids from public.participants where game_id = p_game_id;
  select array_agg(distinct id order by id) into v_expected_ids from unnest(coalesce(p_expected_participant_ids, array[]::uuid[])) as ids(id);
  if v_count < 2 then raise exception 'not_enough_participants'; end if;
  if coalesce(cardinality(p_expected_participant_ids), 0) <> v_count or v_expected_ids is distinct from v_current_ids then raise exception 'roster_changed'; end if;
  if jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) <> v_count then raise exception 'invalid_pair_count'; end if;
  select count(*), count(distinct giver_id), count(distinct receiver_id) into v_pair_count, v_unique_givers, v_unique_receivers from jsonb_to_recordset(p_pairs) as pair(giver_id uuid, receiver_id uuid);
  if v_pair_count <> v_count or v_unique_givers <> v_count or v_unique_receivers <> v_count then raise exception 'not_a_bijection'; end if;
  if exists (select 1 from jsonb_to_recordset(p_pairs) as pair(giver_id uuid, receiver_id uuid) where giver_id = receiver_id) then raise exception 'self_assignment'; end if;
  if exists (select 1 from jsonb_to_recordset(p_pairs) as pair(giver_id uuid, receiver_id uuid) where not (giver_id = any(v_current_ids)) or not (receiver_id = any(v_current_ids))) then raise exception 'participant_outside_game'; end if;
  if exists (select 1 from jsonb_to_recordset(p_pairs) as pair(giver_id uuid, receiver_id uuid) join public.restrictions r on r.game_id = p_game_id and r.giver_id = pair.giver_id and r.receiver_id = pair.receiver_id) then raise exception 'restriction_violated'; end if;
  insert into public.assignments (game_id, giver_id, receiver_id) select p_game_id, pair.giver_id, pair.receiver_id from jsonb_to_recordset(p_pairs) as pair(giver_id uuid, receiver_id uuid);
  update public.games set status = 'drawn' where id = p_game_id;
  return jsonb_build_object('status', 'drawn', 'participant_count', v_count);
end;
$$;
revoke all on function public.finalize_secret_santa_draw(uuid, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.finalize_secret_santa_draw(uuid, text, uuid[], jsonb) to service_role;