begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select is((select count(*) from pg_tables where schemaname in ('app','private')),12::bigint,'twelve foundation tables');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('app','private') and c.relkind='r'),'RLS enabled on all foundation tables');
select ok(not has_function_privilege('anon','api.publish_offer(uuid,integer)','EXECUTE'),'anonymous caller cannot publish');
select ok(not has_table_privilege('authenticated','private.release_controls','UPDATE'),'release controls are owner controlled');
select ok(not has_table_privilege('authenticated','private.dusk_admins','INSERT'),'administrator grants cannot be self assigned');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('api','private') and p.prosecdef and not ('search_path=""'=any(p.proconfig))), 'definer functions pin empty search paths');
select is((select time_zone from app.markets where id='las-vegas'),'America/Los_Angeles','Vegas time zone');
select is((select count(*) from api.public_venues),0::bigint,'initial public venues empty');
select is((select count(*) from api.public_offers),0::bigint,'initial public offers empty');
select throws_ok($$insert into app.markets values('bad','Bad','NV','Bogus/Zone',0,0,true)$$,'23514','invalid IANA time zone','invalid market zone rejected');
select throws_ok($$update app.venues set lat=91 where id='00000000-0000-4000-8000-000000000001'$$,'23514',null,'coordinate bounds enforced');
select throws_ok($$update app.venues set is_demo=false where id='00000000-0000-4000-8000-000000000001'$$,'55000','venue identity is immutable','demo cannot become real');
select throws_ok($$update app.venues set status='published' where id='00000000-0000-4000-8000-000000000001'$$,'23514',null,'demo cannot have published status');

insert into auth.users(id,email) select ('10000000-0000-4000-8000-00000000000'||n)::uuid,'synthetic-'||n||'@example.invalid' from generate_series(1,6) n;
insert into app.accounts(id,auth_user_id,display_name)
  select id,id,'SYNTHETIC account' from auth.users where id::text like '10000000-0000-4000-8000-00000000000%';
insert into private.dusk_admins values('10000000-0000-4000-8000-000000000005',true,'SYNTHETIC local test grant');
insert into app.venue_memberships(venue_id,account_id,role,granted_by) values
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','employee','10000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','manager','10000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006','manager','10000000-0000-4000-8000-000000000005');
insert into app.offers(id,venue_id) values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
create function pg_temp.content() returns jsonb language sql as $$select '{"title":"SYNTHETIC $1 preview","description":"Synthetic test only","product":"test drink","terms":"Not redeemable","priceCents":100,"schedule":{"timeZone":"America/Los_Angeles","startsOn":"2026-01-01","endsBefore":"2029-01-01","weekly":[{"day":"Fri","start":"22:00","end":"02:00"}]}}'::jsonb$$;
select ok(private.valid_schedule(pg_temp.content()->'schedule'),'valid schedule accepted');
select ok(not private.valid_schedule(jsonb_set(pg_temp.content()->'schedule','{startsOn}','"2026-02-30"')),'invalid calendar date rejected');
select ok(not private.valid_schedule(jsonb_set(pg_temp.content()->'schedule','{weekly}','[{"day":"Fri","start":"22:00","end":"22:00"}]')),'equal schedule endpoints rejected');
select ok(private.matches_schedule(pg_temp.content()->'schedule','2026-11-21T09:00:00Z'),'overnight tail matches local service date');
select ok(not private.matches_schedule(pg_temp.content()->'schedule','2026-11-21T10:00:00Z'),'end exclusive');
select ok(private.matches_schedule(jsonb_set(pg_temp.content()->'schedule','{exceptions}','{"2026-11-21":[]}'),'2026-11-21T09:00:00Z'),'closed next day preserves previous overnight tail');
select ok(not private.matches_schedule(jsonb_set(pg_temp.content()->'schedule','{exceptions}','{"2026-11-20":[]}'),'2026-11-21T09:00:00Z'),'closure cancels its overnight tail');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from app.accounts),1::bigint,'customer sees only own account');
select is((select count(*) from app.accounts where id='10000000-0000-4000-8000-000000000002'),0::bigint,'customer cannot see another account');
select is((select count(*) from api.my_venues),0::bigint,'customer has no internal venues');
select throws_ok($$update app.accounts set status='active'$$,'42501',null,'direct account writes denied');
select throws_ok($$select * from private.venue_verifications$$,'42501',null,'private evidence denied');
select throws_ok($$select * from private.audit_events$$,'42501',null,'private audit denied');
select throws_ok($$select api.get_venue_verifications('00000000-0000-4000-8000-000000000001')$$,'42501',null,'customer cannot use verification RPC');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from api.my_venues),1::bigint,'employee sees assigned venue');
select is((select count(*) from app.venues where id='00000000-0000-4000-8000-000000000002'),0::bigint,'employee cannot see another venue');
select throws_ok($$update app.venue_memberships set role='manager'$$,'42501',null,'employee cannot elevate role');
select throws_ok($$select api.create_offer('00000000-0000-4000-8000-000000000001')$$,'42501',null,'employee cannot create offers');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select api.create_offer('00000000-0000-4000-8000-000000000001')$$,'42501',null,'manager writes require MFA');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select api.create_offer('00000000-0000-4000-8000-000000000002')$$,'42501',null,'manager cannot write across venues');
select is(api.create_offer_revision('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',pg_temp.content()),1,'manager creates immutable revision');
select is(api.create_offer_revision('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',pg_temp.content()),1,'same request retry returns same revision');
select throws_ok($$select api.create_offer_revision('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.content(),'{title}','"Changed"'))$$,'23505',null,'request ID cannot overwrite content');
select throws_ok($$select api.create_offer_revision('20000000-0000-4000-8000-000000000001',gen_random_uuid(),jsonb_set(pg_temp.content(),'{schedule,timeZone}','"America/New_York"'))$$,'23514',null,'schedule zone must match venue');
select throws_ok($$select api.create_offer_revision('20000000-0000-4000-8000-000000000001',gen_random_uuid(),jsonb_set(pg_temp.content(),'{priceCents}','1.5'))$$,'23514',null,'fractional cents rejected');
select lives_ok($$select api.submit_offer_revision('20000000-0000-4000-8000-000000000001',1)$$,'manager submits revision');
select throws_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000001',1,'approved','test','test')$$,'42501',null,'manager cannot approve');
select throws_ok($$select api.publish_offer('20000000-0000-4000-8000-000000000001',1)$$,'42501',null,'manager cannot publish');
select throws_ok($$select api.set_membership('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','manager','active')$$,'42501',null,'manager cannot assign memberships');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000001',1,'approved','test','test')$$,'42501',null,'admin review requires MFA');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000001',1,'approved','SYNTHETIC review','SYNTHETIC evidence')$$,'admin reviews exact revision');
select throws_ok($$select api.publish_offer('20000000-0000-4000-8000-000000000001',1)$$,'42501',null,'approval cannot enable live publication');
select lives_ok($$select api.set_membership('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','manager','inactive')$$,'admin removes membership');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from api.my_venues),0::bigint,'membership revocation takes effect with existing token');
select throws_ok($$select api.pause_offer('20000000-0000-4000-8000-000000000001')$$,'42501',null,'removed manager cannot use old token');
reset role;
select throws_ok($$update app.offer_revisions set title='Changed'$$,'55000','immutable record','revision trigger prevents overwrite');
select throws_ok($$delete from private.offer_reviews$$,'55000','immutable record','reviews are append only');
select throws_ok($$delete from private.audit_events$$,'55000','immutable record','audit is append only');

-- Simulate already-published records inside this rollback-only test transaction.
-- These controls and synthetic real-shaped records never persist or reach the app.
update private.release_controls set environment='production', live_venues_enabled=true, live_offers_enabled=true, founder_authorization_reference='SYNTHETIC TEST ONLY';
update private.licensing_jurisdictions set live_offers_allowed=true,legal_review_reference='SYNTHETIC TEST ONLY';
insert into app.venues(id,market_id,jurisdiction_id,name,neighborhood,category,is_demo,status,address)
  values('00000000-0000-4000-8000-000000000003','las-vegas','synthetic-nv','SYNTHETIC real-shaped fixture','Test','bar',false,'published','SYNTHETIC address');
insert into private.venue_verifications(venue_id,verification_version,snapshot,source,license_reference,reviewed_by,valid_until)
  values('00000000-0000-4000-8000-000000000003',1,'{}','SYNTHETIC source','SYNTHETIC license','10000000-0000-4000-8000-000000000005',now()+interval '1 day');
insert into app.offers(id,venue_id) values('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into app.offer_revisions(offer_id,revision_no,request_id,title,description,product,terms,price_cents,schedule,created_by)
 values('20000000-0000-4000-8000-000000000002',1,gen_random_uuid(),'SYNTHETIC','SYNTHETIC','SYNTHETIC','SYNTHETIC',100,pg_temp.content()->'schedule','10000000-0000-4000-8000-000000000005');
insert into private.offer_reviews(offer_id,revision_no,decision,actor_id,reason,evidence_reference)
 values('20000000-0000-4000-8000-000000000002',1,'approved','10000000-0000-4000-8000-000000000005','SYNTHETIC','PRIVATE EVIDENCE');
update app.offers set status='published',published_revision_no=1 where id='20000000-0000-4000-8000-000000000002';
set local role anon;
select set_config('request.jwt.claims','{}',true);
select is((select count(*) from api.public_venues),1::bigint,'eligible synthetic published venue is visible');
select is((select count(*) from api.public_offers),1::bigint,'eligible synthetic revision is visible');
select ok(not (select to_jsonb(o) ? 'evidence_reference' from api.public_offers o),'public feed excludes review evidence');
select throws_ok($$select * from private.venue_verifications$$,'42501',null,'anonymous cannot read verification');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000002',1,'revoked','SYNTHETIC revocation',null)$$,'admin revokes published revision');
select is((select count(*) from api.public_offers),0::bigint,'revocation removes public offer immediately even for admin');
select throws_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000002',1,'approved','test','test')$$,'23514',null,'revoked revision cannot be reapproved');
select lives_ok($$select api.suspend_venue('00000000-0000-4000-8000-000000000003')$$,'admin suspends venue');
select is((select count(*) from api.public_venues),0::bigint,'suspension removes public venue immediately');
reset role;
update app.venues set status='published' where id='00000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select api.invalidate_venue_verification('00000000-0000-4000-8000-000000000003')$$,'admin invalidates venue verification');
select is((select count(*) from api.public_venues),0::bigint,'invalidated verification removes eligibility');
reset role;
update app.venues set status='published' where id='00000000-0000-4000-8000-000000000003';
select ok(not private.venue_public('00000000-0000-4000-8000-000000000003'),'published status alone cannot restore invalid verification');
select throws_ok($$delete from private.venue_verifications$$,'55000','immutable record','verification evidence immutable');

select throws_ok($$insert into app.offers(venue_id) values(gen_random_uuid())$$,'23503',null,'foreign key rejects nonexistent venue');
select throws_ok($$insert into private.dusk_admins values('10000000-0000-4000-8000-000000000005',true,'duplicate')$$,'23505',null,'admin identity is unique');
select ok(not private.valid_schedule(jsonb_set(pg_temp.content()->'schedule','{privateSource}','"leak"')),'unexpected schedule keys rejected');
select ok(not private.matches_schedule(pg_temp.content()->'schedule','2029-01-01T09:00:00Z'),'schedule date range is end exclusive');
select ok(private.matches_schedule(jsonb_set(pg_temp.content()->'schedule','{weekly}','[{"day":"Sun","start":"01:30","end":"02:30"}]'),'2026-11-01T08:45:00Z'),'fall-back first repeated minute');
select ok(private.matches_schedule(jsonb_set(pg_temp.content()->'schedule','{weekly}','[{"day":"Sun","start":"01:30","end":"02:30"}]'),'2026-11-01T09:45:00Z'),'fall-back second repeated minute');
select ok(not private.matches_schedule(jsonb_set(pg_temp.content()->'schedule','{weekly}','[{"day":"Sun","start":"02:00","end":"02:30"}]'),'2026-03-08T10:15:00Z'),'spring-forward missing minutes do not match');
insert into private.venue_verifications(venue_id,verification_version,snapshot,source,license_reference,reviewed_by,reviewed_at,valid_until)
  values('00000000-0000-4000-8000-000000000003',2,'{}','SYNTHETIC expired','SYNTHETIC license','10000000-0000-4000-8000-000000000005',now()-interval '2 days',now()-interval '1 day');
select ok(not private.venue_public('00000000-0000-4000-8000-000000000003'),'expired evidence cannot authorize a previously published venue');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select api.review_offer_revision('20000000-0000-4000-8000-000000000002',2,'approved','test','test')$$,'23514',null,'missing submission cannot be approved');
select lives_ok($$select api.verify_venue('00000000-0000-4000-8000-000000000003','SYNTHETIC source',null,'SYNTHETIC license',now()+interval '1 day')$$,'admin can replace expired verification');
select lives_ok($$select api.publish_venue('00000000-0000-4000-8000-000000000003')$$,'explicit authorized transition accepts current synthetic verification in rollback test');
select is((select count(*) from api.public_venues),1::bigint,'reverified synthetic venue eligible in rollback test');
select lives_ok($$select api.update_venue_details('00000000-0000-4000-8000-000000000003','SYNTHETIC changed name','SYNTHETIC address',null,null,'synthetic-nv')$$,'admin changes material venue information');
select is((select count(*) from api.public_venues),0::bigint,'material edit immediately removes previous publication eligibility');
reset role;
select * from finish();
rollback;
