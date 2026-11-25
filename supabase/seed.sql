-- Reference markets mirror src/domain/markets.ts. All database venues below are synthetic.
insert into app.markets(id,display_name,state_code,time_zone,center_lat,center_lng) values
  ('las-vegas','Las Vegas','NV','America/Los_Angeles',36.145,-115.156),
  ('atlantic-city','Atlantic City','NJ','America/New_York',39.3643,-74.4229),
  ('new-york-city','New York City','NY','America/New_York',40.725,-73.975);
insert into private.licensing_jurisdictions(id,name,state_code,authority) values
  ('synthetic-nv','SYNTHETIC Nevada jurisdiction','NV','SYNTHETIC TEST AUTHORITY');
insert into app.venues(id,market_id,jurisdiction_id,name,neighborhood,category,is_demo,status,lat,lng,coordinate_kind) values
  ('00000000-0000-4000-8000-000000000001','las-vegas','synthetic-nv','SYNTHETIC Foundation Venue A','Test area','bar',true,'preview',36.15,-115.15,'demo'),
  ('00000000-0000-4000-8000-000000000002','las-vegas','synthetic-nv','SYNTHETIC Foundation Venue B','Test area','bar',true,'preview',36.16,-115.15,'demo');
