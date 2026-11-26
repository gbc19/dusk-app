create function private.current_account_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from app.accounts where auth_user_id = (select auth.uid()) and status = 'active'
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.dusk_admins where account_id = private.current_account_id() and active)
$$;
create function private.can_read_venue(venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists(select 1 from app.venue_memberships
    where venue_id = venue and account_id = private.current_account_id() and status = 'active')
$$;
create function private.can_manage_venue(venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists(select 1 from app.venue_memberships
    where venue_id = venue and account_id = private.current_account_id() and status = 'active' and role = 'manager')
$$;
create function private.require_actor(admin_only boolean default false) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.current_account_id();
begin
  if actor is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' or (admin_only and not private.is_admin()) then
    raise exception 'active authorized account with MFA required' using errcode = '42501';
  end if;
  return actor;
end $$;
create function private.write_audit(action text, venue uuid default null, offer uuid default null, details jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into private.audit_events(actor_id, venue_id, offer_id, action, details)
  values(private.current_account_id(), venue, offer, action, details)
$$;

create function private.venue_public(venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app.venues v
    join app.markets m on m.id = v.market_id
    join private.licensing_jurisdictions j on j.id = v.jurisdiction_id
    join private.release_controls c on c.singleton
    join private.venue_verifications e on e.venue_id = v.id and e.verification_version = v.verification_version
    where v.id = venue and not v.is_demo and v.status = 'published' and m.enabled
      and c.environment = 'production' and c.live_venues_enabled
      and private.has_text(c.founder_authorization_reference)
      and j.live_offers_allowed and private.has_text(j.legal_review_reference)
      and (v.lat is null or v.coordinate_kind = 'verified') and e.valid_until > statement_timestamp())
$$;
create function private.latest_review(offer uuid, revision integer) returns text
language sql stable security definer set search_path = '' as $$
  select decision from private.offer_reviews where offer_id = offer and revision_no = revision order by id desc limit 1
$$;
create function private.offer_public(offer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app.offers o join private.release_controls c on c.singleton
    join app.offer_revisions r on r.offer_id = o.id and r.revision_no = o.published_revision_no
    join app.venues v on v.id = o.venue_id join app.markets m on m.id = v.market_id
    where o.id = offer and o.status = 'published' and private.venue_public(o.venue_id)
      and c.live_offers_enabled and r.schedule->>'timeZone' = m.time_zone
      and private.latest_review(o.id, o.published_revision_no) = 'approved')
$$;
create function private.can_read_offer(offer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app.offers where id = offer and private.can_read_venue(venue_id))
$$;

grant usage on schema app, api, private to anon, authenticated;
grant execute on function private.current_account_id(), private.is_admin(), private.can_read_venue(uuid),
  private.can_manage_venue(uuid), private.venue_public(uuid), private.offer_public(uuid), private.can_read_offer(uuid)
  to anon, authenticated;
grant select on app.markets, app.venues, app.offers to anon, authenticated;
grant select on app.accounts, app.venue_memberships to authenticated;
grant select (offer_id, revision_no, title, description, product, terms, price_cents, currency,
  schedule, per_customer_limit, per_occurrence_limit, inventory_units) on app.offer_revisions to anon, authenticated;
create policy read_markets on app.markets for select to anon, authenticated using (enabled);
create policy own_account on app.accounts for select to authenticated using (auth_user_id = (select auth.uid()));
create policy own_memberships on app.venue_memberships for select to authenticated
  using (account_id = private.current_account_id() or private.is_admin());
create policy read_venues on app.venues for select to anon, authenticated
  using (private.venue_public(id) or private.can_read_venue(id));
create policy read_offers on app.offers for select to anon, authenticated
  using (private.offer_public(id) or private.can_read_venue(venue_id));
create policy read_revisions on app.offer_revisions for select to anon, authenticated
  using (private.can_read_offer(offer_id) or exists(select 1 from app.offers o
    where o.id = offer_id and o.published_revision_no = revision_no and private.offer_public(o.id)));

create view api.markets with (security_invoker = true) as
  select id, display_name, state_code, time_zone, center_lat, center_lng from app.markets;
create view api.my_account with (security_invoker = true) as
  select id, display_name, status from app.accounts;
create view api.my_venues with (security_invoker = true) as
  select id, market_id, name, category, neighborhood, is_demo, status from app.venues
  where private.can_read_venue(id);
create view api.public_venues with (security_invoker = true) as
  select v.id, v.market_id, m.display_name as city, m.time_zone, v.name, v.neighborhood,
    v.category, v.address, case when v.coordinate_kind = 'verified' then v.lat end as lat,
    case when v.coordinate_kind = 'verified' then v.lng end as lng
  from app.venues v join app.markets m on m.id = v.market_id where private.venue_public(v.id);
-- This is a publication feed. Availability remains separate from publication and redemption.
create view api.public_offers with (security_invoker = true) as
  select o.id, o.venue_id, r.revision_no, r.title, r.description, r.product, r.terms,
    r.price_cents, r.currency, r.schedule, r.per_customer_limit, r.per_occurrence_limit, r.inventory_units
  from app.offers o join app.offer_revisions r on r.offer_id = o.id and r.revision_no = o.published_revision_no
  where private.offer_public(o.id);
grant select on api.markets, api.public_venues, api.public_offers to anon, authenticated;
grant select on api.my_account, api.my_venues to authenticated;

create function api.ensure_account(display_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  insert into app.accounts(auth_user_id, display_name) values(auth.uid(), display_name)
    on conflict (auth_user_id) do nothing returning id into result;
  if result is null then result := private.current_account_id(); end if;
  if result is null then raise exception 'account inactive' using errcode = '42501'; end if;
  return result;
end $$;
create function api.update_my_profile(display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_account_id() is null then raise exception 'account unavailable' using errcode = '42501'; end if;
  update app.accounts set display_name = update_my_profile.display_name where id = private.current_account_id();
end $$;

create function api.set_membership(venue_id uuid, account_id uuid, member_role text, member_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(true);
begin
  perform 1 from app.venues where id = venue_id for update;
  if not found then raise exception 'venue unavailable' using errcode = '42501'; end if;
  insert into app.venue_memberships(venue_id, account_id, role, status, granted_by)
    values(venue_id, account_id, member_role, member_status, actor)
    on conflict on constraint venue_memberships_pkey do update
      set role = excluded.role, status = excluded.status, granted_by = actor, updated_at = now();
  perform private.write_audit('membership_changed', venue_id, null, jsonb_build_object('role', member_role, 'status', member_status));
end $$;

create function api.create_venue(market_id text, jurisdiction_id text, venue_name text, neighborhood text, category text, is_demo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_actor(true);
  insert into app.venues(market_id, jurisdiction_id, name, neighborhood, category, is_demo, status)
    values(market_id, jurisdiction_id, venue_name, neighborhood, category, is_demo, case when is_demo then 'preview' else 'draft' end)
    returning id into result;
  perform private.write_audit('venue_created', result);
  return result;
end $$;
create function api.update_venue_details(venue_id uuid, venue_name text, address text, lat double precision, lng double precision, jurisdiction_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  perform 1 from app.venues where id = venue_id for update;
  if not found then raise exception 'venue unavailable' using errcode = '42501'; end if;
  update app.venues v set name = venue_name, address = update_venue_details.address,
    lat = update_venue_details.lat, lng = update_venue_details.lng,
    coordinate_kind = case when update_venue_details.lat is null then null when v.is_demo then 'demo' else 'unverified' end,
    jurisdiction_id = update_venue_details.jurisdiction_id where v.id = venue_id;
  perform private.write_audit('venue_details_updated', venue_id);
end $$;
create function api.verify_venue(venue_id uuid, source text, coordinate_source text, license_reference text, valid_until timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v app.venues; actor uuid := private.require_actor(true);
begin
  select * into v from app.venues where id = venue_id for update;
  if not found or v.is_demo or not private.has_text(v.address) or v.jurisdiction_id is null
    or (v.lat is not null and not private.has_text(coordinate_source)) then
    raise exception 'venue verification requirements not met' using errcode = '23514';
  end if;
  if exists(select 1 from private.venue_verifications e where e.venue_id = v.id and e.verification_version = v.verification_version) then
    update app.venues set verification_version = verification_version + 1 where id = v.id returning * into v;
  end if;
  update app.venues set status = 'verified', coordinate_kind = case when v.lat is null then null else 'verified' end where id = v.id;
  insert into private.venue_verifications(venue_id, verification_version, snapshot, source, coordinate_source, license_reference, reviewed_by, valid_until)
    values(v.id, v.verification_version, jsonb_build_object('name',v.name,'address',v.address,'jurisdiction',v.jurisdiction_id,'lat',v.lat,'lng',v.lng),
      source, coordinate_source, license_reference, actor, valid_until);
  perform private.write_audit('venue_verified', v.id);
end $$;
create function api.invalidate_venue_verification(venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  update app.venues set verification_version = verification_version + 1 where id = venue_id;
  if not found then raise exception 'venue unavailable' using errcode = '42501'; end if;
  perform private.write_audit('verification_invalidated', venue_id);
end $$;
create function api.suspend_venue(venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  update app.venues set status = 'suspended' where id = venue_id and not is_demo;
  if not found then raise exception 'real venue unavailable' using errcode = '42501'; end if;
  perform private.write_audit('venue_suspended', venue_id);
end $$;

create function private.lock_managed_offer(offer uuid) returns app.offers
language plpgsql security definer set search_path = '' as $$
declare result app.offers;
begin
  perform private.require_actor();
  select * into result from app.offers where id = offer;
  if not found or not private.can_manage_venue(result.venue_id) then
    raise exception 'offer unavailable' using errcode = '42501';
  end if;
  perform 1 from app.venues where id = result.venue_id for update;
  perform private.require_actor();
  if not private.can_manage_venue(result.venue_id) then raise exception 'offer unavailable' using errcode = '42501'; end if;
  select * into result from app.offers where id = offer for update;
  return result;
end $$;
create function api.create_offer(venue_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_actor();
  if not private.can_manage_venue(venue_id) then raise exception 'venue unavailable' using errcode = '42501'; end if;
  perform 1 from app.venues where id = venue_id for update;
  perform private.require_actor();
  if not private.can_manage_venue(venue_id) then raise exception 'venue unavailable' using errcode = '42501'; end if;
  insert into app.offers(venue_id) values(venue_id) returning id into result;
  perform private.write_audit('offer_created', venue_id, result);
  return result;
end $$;
create function api.create_offer_revision(offer_id uuid, request_id uuid, content jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare o app.offers; revision integer; previous app.offer_revisions; actor uuid := private.require_actor(); normalized jsonb;
begin
  o := private.lock_managed_offer(offer_id);
  if content is null or jsonb_typeof(content) <> 'object' or exists(
    select 1 from jsonb_object_keys(content) k where k <> all(array['title','description','product','terms','priceCents','schedule','perCustomerLimit','perOccurrenceLimit','inventoryUnits'])
  ) then raise exception 'invalid revision content' using errcode = '23514'; end if;
  select * into previous from app.offer_revisions r where r.offer_id = o.id and r.request_id = create_offer_revision.request_id;
  if found then
    normalized := jsonb_strip_nulls(jsonb_build_object('title',previous.title,'description',previous.description,'product',previous.product,
      'terms',previous.terms,'priceCents',previous.price_cents,'schedule',previous.schedule,'perCustomerLimit',previous.per_customer_limit,
      'perOccurrenceLimit',previous.per_occurrence_limit,'inventoryUnits',previous.inventory_units));
    if normalized <> jsonb_strip_nulls(content) then raise exception 'request ID already used for different content' using errcode = '23505'; end if;
    return previous.revision_no;
  end if;
  -- Casts are followed by integer/check constraints; fractional JSON numbers are rejected before casting.
  if jsonb_typeof(content->'priceCents') is distinct from 'number' or content->>'priceCents' !~ '^[0-9]+$'
    or exists(select 1 from jsonb_each(content) p where p.key = any(array['perCustomerLimit','perOccurrenceLimit','inventoryUnits'])
      and (jsonb_typeof(p.value) <> 'number' or p.value::text !~ '^[0-9]+$')) then
    raise exception 'integer price and limits required' using errcode = '23514';
  end if;
  if exists(select 1 from unnest(array['title','description','product','terms']) k where jsonb_typeof(content->k) is distinct from 'string') then
    raise exception 'text fields required' using errcode = '23514'; end if;
  select coalesce(max(r.revision_no),0) + 1 into revision from app.offer_revisions r where r.offer_id = o.id;
  insert into app.offer_revisions(offer_id,revision_no,request_id,title,description,product,terms,price_cents,schedule,
    per_customer_limit,per_occurrence_limit,inventory_units,created_by)
  values(o.id,revision,request_id,content->>'title',content->>'description',content->>'product',content->>'terms',
    (content->>'priceCents')::integer,content->'schedule',(content->>'perCustomerLimit')::integer,
    (content->>'perOccurrenceLimit')::integer,(content->>'inventoryUnits')::integer,actor);
  perform private.write_audit('offer_revision_created', o.venue_id, o.id, jsonb_build_object('revision',revision));
  return revision;
end $$;
create function api.submit_offer_revision(offer_id uuid, revision_no integer) returns void
language plpgsql security definer set search_path = '' as $$
declare o app.offers; actor uuid := private.require_actor(); decision text;
begin
  o := private.lock_managed_offer(offer_id);
  decision := private.latest_review(o.id, revision_no);
  if decision = 'submitted' then return; end if;
  if decision is not null then raise exception 'new revision required' using errcode = '23514'; end if;
  insert into private.offer_reviews(offer_id,revision_no,decision,actor_id,reason) values(o.id,revision_no,'submitted',actor,'submitted for review');
  perform private.write_audit('offer_submitted', o.venue_id, o.id, jsonb_build_object('revision',revision_no));
end $$;
create function api.review_offer_revision(offer_id uuid, revision_no integer, decision text, reason text, evidence_reference text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare o app.offers; actor uuid := private.require_actor(true); previous text;
begin
  o := private.lock_managed_offer(offer_id);
  previous := private.latest_review(o.id, revision_no);
  if not coalesce((decision in ('approved','rejected') and previous = 'submitted') or (decision = 'revoked' and previous = 'approved'), false) then
    raise exception 'invalid review transition' using errcode = '23514';
  end if;
  insert into private.offer_reviews(offer_id,revision_no,decision,actor_id,reason,evidence_reference)
    values(o.id,revision_no,decision,actor,reason,evidence_reference);
  if decision = 'revoked' and o.published_revision_no = revision_no then update app.offers set status = 'suspended' where id = o.id; end if;
  perform private.write_audit('offer_reviewed', o.venue_id, o.id, jsonb_build_object('revision',revision_no,'decision',decision));
end $$;
create function api.pause_offer(offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o app.offers;
begin
  o := private.lock_managed_offer(offer_id);
  update app.offers set status = 'suspended' where id = o.id;
  perform private.write_audit('offer_paused',o.venue_id,o.id);
end $$;

create function api.publish_venue(venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor(true);
  perform 1 from app.venues where id = venue_id for update;
  update app.venues set status = 'published' where id = venue_id and not is_demo;
  if not private.venue_public(venue_id) then raise exception 'live venue publication disabled or ineligible' using errcode = '42501'; end if;
  perform private.write_audit('venue_published',venue_id);
end $$;
create function api.publish_offer(offer_id uuid, revision_no integer) returns void
language plpgsql security definer set search_path = '' as $$
declare o app.offers;
begin
  perform private.require_actor(true);
  o := private.lock_managed_offer(offer_id);
  update app.offers set status = 'published', published_revision_no = revision_no where id = o.id;
  if not private.offer_public(o.id) then raise exception 'live offer publication disabled or ineligible' using errcode = '42501'; end if;
  perform private.write_audit('offer_published',o.venue_id,o.id,jsonb_build_object('revision',revision_no));
end $$;

-- No operation grants DUSK admin status or changes release/legal authorization.
revoke execute on all functions in schema api, private from public, anon, authenticated;
grant execute on function private.current_account_id(), private.is_admin(), private.can_read_venue(uuid),
  private.can_manage_venue(uuid), private.venue_public(uuid), private.offer_public(uuid), private.can_read_offer(uuid) to anon, authenticated;
grant execute on all functions in schema api to authenticated;
-- Future functions remain closed through default privileges; this grant covers only the functions above.
notify pgrst, 'reload schema';
