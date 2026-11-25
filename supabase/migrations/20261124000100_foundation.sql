-- Local foundation. No production enablement, customer data, or redemption objects.
create schema app;
create schema private;
create schema api;
revoke all on schema app, private, api from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema app, private, api revoke all on tables from public, anon, authenticated;
alter default privileges in schema app, private, api revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app, private, api revoke execute on functions from public, anon, authenticated;

create function private.has_text(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and length(btrim(value)) between 1 and 2000
$$;

create function private.valid_hours(hours jsonb, weekly boolean) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(hours) <> 'object' or hours is null then return false; end if;
  if exists (select 1 from jsonb_object_keys(hours) k where k <> all (
    case when weekly then array['day','start','end'] else array['start','end'] end
  )) then return false; end if;
  return coalesce(
    jsonb_typeof(hours->'start') = 'string' and jsonb_typeof(hours->'end') = 'string'
    and hours->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and hours->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and hours->>'start' <> hours->>'end'
    and (not weekly or hours->>'day' = any(array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])), false);
end $$;

create function private.valid_schedule(schedule jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  starts date;
  ends date;
  entry record;
  hours jsonb;
begin
  if schedule is null or jsonb_typeof(schedule) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(schedule) k
    where k <> all(array['timeZone','startsOn','endsBefore','weekly','exceptions'])) then return false; end if;
  if jsonb_typeof(schedule->'timeZone') is distinct from 'string'
    or not exists(select 1 from pg_catalog.pg_timezone_names where name = schedule->>'timeZone')
    or jsonb_typeof(schedule->'startsOn') is distinct from 'string'
    or jsonb_typeof(schedule->'endsBefore') is distinct from 'string'
    or schedule->>'startsOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or schedule->>'endsBefore' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or jsonb_typeof(schedule->'weekly') is distinct from 'array'
    then return false; end if;
  starts := (schedule->>'startsOn')::date;
  ends := (schedule->>'endsBefore')::date;
  if starts >= ends or to_char(starts, 'YYYY-MM-DD') <> schedule->>'startsOn'
    or to_char(ends, 'YYYY-MM-DD') <> schedule->>'endsBefore' then return false; end if;
  for hours in select value from jsonb_array_elements(schedule->'weekly') loop
    if not private.valid_hours(hours, true) then return false; end if;
  end loop;
  if schedule ? 'exceptions' then
    if jsonb_typeof(schedule->'exceptions') <> 'object' then return false; end if;
    for entry in select * from jsonb_each(schedule->'exceptions') loop
      if entry.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or entry.key::date < starts
        or entry.key::date >= ends or to_char(entry.key::date, 'YYYY-MM-DD') <> entry.key
        or jsonb_typeof(entry.value) <> 'array' then return false; end if;
      for hours in select value from jsonb_array_elements(entry.value) loop
        if not private.valid_hours(hours, false) then return false; end if;
      end loop;
    end loop;
  end if;
  return true;
exception when others then return false;
end $$;

-- Matches the existing wall-clock contract, including prior-service-date overnight tails.
create function private.schedule_windows(schedule jsonb, service_date date) returns jsonb
language sql immutable set search_path = '' as $$
  select case when schedule->'exceptions' ? to_char(service_date, 'YYYY-MM-DD')
    then schedule->'exceptions'->to_char(service_date, 'YYYY-MM-DD')
    else coalesce((select jsonb_agg(w) from jsonb_array_elements(schedule->'weekly') w
      where w->>'day' = (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from service_date)::int + 1]), '[]'::jsonb) end
$$;

create function private.matches_schedule(schedule jsonb, at_time timestamptz) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  local_time timestamp;
  local_date date;
  clock text;
begin
  if at_time is null or not isfinite(at_time) or not private.valid_schedule(schedule) then return false; end if;
  local_time := at_time at time zone (schedule->>'timeZone');
  local_date := local_time::date;
  clock := to_char(local_time, 'HH24:MI');
  if local_date < (schedule->>'startsOn')::date or local_date >= (schedule->>'endsBefore')::date then return false; end if;
  return exists(select 1 from jsonb_array_elements(private.schedule_windows(schedule, local_date)) w
    where clock >= w->>'start' and (w->>'end' < w->>'start' or clock < w->>'end'))
    or (local_date - 1 >= (schedule->>'startsOn')::date and exists(
      select 1 from jsonb_array_elements(private.schedule_windows(schedule, local_date - 1)) w
      where w->>'end' < w->>'start' and clock < w->>'end'));
end $$;

create table app.markets (
  id text primary key check (id ~ '^[a-z][a-z0-9-]+$'),
  display_name text not null check (private.has_text(display_name)),
  state_code text not null,
  time_zone text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  enabled boolean not null default true
);
create table app.accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text check (display_name is null or private.has_text(display_name)),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);
create table private.licensing_jurisdictions (
  id text primary key,
  name text not null check (private.has_text(name)),
  state_code text not null,
  authority text not null check (private.has_text(authority)),
  live_offers_allowed boolean not null default false,
  legal_review_reference text,
  check (not live_offers_allowed or private.has_text(legal_review_reference))
);
create table app.venues (
  id uuid primary key default gen_random_uuid(),
  market_id text not null references app.markets(id),
  jurisdiction_id text references private.licensing_jurisdictions(id),
  name text not null check (private.has_text(name)),
  neighborhood text not null check (private.has_text(neighborhood)),
  category text not null check (category in ('bar','cocktail-bar','beer-hall','nightclub','sports-bar','rooftop-bar')),
  is_demo boolean not null default true,
  status text not null default 'preview' check (status in ('preview','draft','verified','published','suspended')),
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  coordinate_kind text check (coordinate_kind in ('demo','unverified','verified')),
  verification_version integer not null default 1 check (verification_version > 0),
  created_at timestamptz not null default now(),
  check ((lat is null and lng is null and coordinate_kind is null) or
         (lat is not null and lng is not null and coordinate_kind is not null)),
  check ((is_demo and status = 'preview' and address is null and (coordinate_kind is null or coordinate_kind = 'demo'))
    or (not is_demo and status <> 'preview' and (coordinate_kind is null or coordinate_kind <> 'demo'))),
  check (status not in ('verified','published') or (private.has_text(address) and jurisdiction_id is not null))
);
create table app.venue_memberships (
  venue_id uuid references app.venues(id),
  account_id uuid references app.accounts(id),
  role text not null check (role in ('employee','manager')),
  status text not null default 'active' check (status in ('active','inactive')),
  granted_by uuid not null references app.accounts(id),
  updated_at timestamptz not null default now(),
  primary key (venue_id, account_id)
);
create table private.dusk_admins (
  account_id uuid primary key references app.accounts(id),
  active boolean not null default true,
  grant_reference text not null check (private.has_text(grant_reference))
);
create table private.venue_verifications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references app.venues(id),
  verification_version integer not null check (verification_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  source text not null check (private.has_text(source)),
  coordinate_source text,
  license_reference text not null check (private.has_text(license_reference)),
  reviewed_by uuid not null references app.accounts(id),
  reviewed_at timestamptz not null default now(),
  valid_until timestamptz not null,
  unique (venue_id, verification_version),
  check (valid_until > reviewed_at)
);
create table app.offers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references app.venues(id),
  status text not null default 'draft' check (status in ('draft','published','suspended')),
  published_revision_no integer,
  created_at timestamptz not null default now(),
  check (status <> 'published' or published_revision_no is not null)
);
create table app.offer_revisions (
  offer_id uuid references app.offers(id),
  revision_no integer check (revision_no > 0),
  request_id uuid not null,
  title text not null check (private.has_text(title)),
  description text not null check (private.has_text(description)),
  product text not null check (private.has_text(product)),
  terms text not null check (private.has_text(terms)),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  schedule jsonb not null check (private.valid_schedule(schedule)),
  per_customer_limit integer check (per_customer_limit > 0),
  per_occurrence_limit integer check (per_occurrence_limit > 0),
  inventory_units integer check (inventory_units > 0),
  created_by uuid not null references app.accounts(id),
  created_at timestamptz not null default now(),
  primary key (offer_id, revision_no),
  unique (offer_id, request_id)
);
alter table app.offers add foreign key (id, published_revision_no)
  references app.offer_revisions(offer_id, revision_no) deferrable initially deferred;
create table private.offer_reviews (
  id bigint generated always as identity primary key,
  offer_id uuid not null,
  revision_no integer not null,
  decision text not null check (decision in ('submitted','approved','rejected','revoked')),
  actor_id uuid not null references app.accounts(id),
  reason text not null check (private.has_text(reason)),
  evidence_reference text,
  occurred_at timestamptz not null default now(),
  foreign key (offer_id, revision_no) references app.offer_revisions(offer_id, revision_no),
  check (decision <> 'approved' or private.has_text(evidence_reference))
);
create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references app.accounts(id),
  venue_id uuid references app.venues(id),
  offer_id uuid references app.offers(id),
  action text not null check (private.has_text(action)),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object')
);
create table private.release_controls (
  singleton boolean primary key default true check (singleton),
  environment text not null default 'local' check (environment in ('local','production')),
  live_venues_enabled boolean not null default false,
  live_offers_enabled boolean not null default false,
  founder_authorization_reference text,
  check (not (live_venues_enabled or live_offers_enabled) or private.has_text(founder_authorization_reference)),
  check (not live_offers_enabled or live_venues_enabled)
);
insert into private.release_controls(singleton) values (true);

create index on app.venues(market_id, status);
create index on app.venues(jurisdiction_id);
create index on app.venue_memberships(account_id, status, venue_id);
create index on app.offers(venue_id, status);
create index on private.offer_reviews(offer_id, revision_no, id desc);
create index on private.audit_events(venue_id, occurred_at desc);
create index on private.audit_events(actor_id, occurred_at desc);

create function private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'immutable record' using errcode = '55000'; end $$;
create trigger immutable_revision before update or delete on app.offer_revisions
  for each row execute function private.reject_mutation();
create trigger immutable_review before update or delete on private.offer_reviews
  for each row execute function private.reject_mutation();
create trigger immutable_verification before update or delete on private.venue_verifications
  for each row execute function private.reject_mutation();
create trigger immutable_audit before update or delete on private.audit_events
  for each row execute function private.reject_mutation();

create function private.guard_venue_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.is_demo <> old.is_demo then
    raise exception 'venue identity is immutable' using errcode = '55000';
  end if;
  if (new.market_id, new.jurisdiction_id, new.name, new.address, new.lat, new.lng, new.category, new.neighborhood)
    is distinct from (old.market_id, old.jurisdiction_id, old.name, old.address, old.lat, old.lng, old.category, old.neighborhood)
    or new.verification_version <> old.verification_version then
    new.verification_version := old.verification_version + 1;
    new.status := case when new.is_demo then 'preview' else 'draft' end;
    new.coordinate_kind := case when new.lat is null then null when new.is_demo then 'demo' else 'unverified' end;
  end if;
  return new;
end $$;
create trigger guard_venue before update on app.venues for each row execute function private.guard_venue_change();

create function private.guard_offer_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.venue_id <> old.venue_id then
    raise exception 'offer identity is immutable' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger guard_offer before update on app.offers for each row execute function private.guard_offer_change();

create function private.validate_revision_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.schedule->>'timeZone' is distinct from (
    select m.time_zone from app.offers o join app.venues v on v.id = o.venue_id
    join app.markets m on m.id = v.market_id where o.id = new.offer_id
  ) then raise exception 'schedule time zone must match market' using errcode = '23514'; end if;
  return new;
end $$;
create trigger revision_zone before insert on app.offer_revisions for each row execute function private.validate_revision_zone();

-- Explicit privileges are added in the security migration. Every table starts closed.
do $$ declare t record; begin
  for t in select schemaname, tablename from pg_tables where schemaname in ('app','private') loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    execute format('revoke all on table %I.%I from public, anon, authenticated', t.schemaname, t.tablename);
  end loop;
end $$;
revoke all on all sequences in schema app, private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
