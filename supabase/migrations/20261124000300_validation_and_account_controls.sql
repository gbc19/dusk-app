create function private.validate_market() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid IANA time zone' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger market_zone before insert or update on app.markets for each row execute function private.validate_market();

create function api.set_account_status(account_id uuid, account_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  perform 1 from app.accounts where id = account_id for update;
  if not found then raise exception 'account unavailable' using errcode = '42501'; end if;
  perform private.write_audit('account_status_changed', null, null, jsonb_build_object('account',account_id,'status',account_status));
  update app.accounts set status = account_status where id = account_id;
end $$;
create function api.get_venue_verifications(venue_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.reviewed_at desc)
    from private.venue_verifications e where e.venue_id = get_venue_verifications.venue_id), '[]'::jsonb);
end $$;
revoke execute on function private.validate_market() from public, anon, authenticated;
revoke execute on function api.set_account_status(uuid,text), api.get_venue_verifications(uuid) from public, anon, authenticated;
grant execute on function api.set_account_status(uuid,text), api.get_venue_verifications(uuid) to authenticated;
notify pgrst, 'reload schema';
