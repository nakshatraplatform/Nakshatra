-- LOCAL DEMO ONLY. This file is intentionally not part of the default seed.
-- Load it with: npm run demo:broker-pilot:reset
-- All three accounts use the local-only password documented in
-- docs/broker-pilot-test-runbook.md.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111101','authenticated','authenticated','rahulgr3001@gmail.com',extensions.crypt('VivintroDemo!2026',extensions.gen_salt('bf')),pg_catalog.now(),'{"provider":"email","providers":["email"]}','{"full_name":"Ravi Sharma"}',pg_catalog.now(),pg_catalog.now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111102','authenticated','authenticated','gollapalliranganatha@gmail.com',extensions.crypt('VivintroDemo!2026',extensions.gen_salt('bf')),pg_catalog.now(),'{"provider":"email","providers":["email"]}','{"full_name":"Suresh Reddy"}',pg_catalog.now(),pg_catalog.now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111103','authenticated','authenticated','ranganathaga64@gmail.com',extensions.crypt('VivintroDemo!2026',extensions.gen_salt('bf')),pg_catalog.now(),'{"provider":"email","providers":["email"]}','{"full_name":"Ananya Rao"}',pg_catalog.now(),pg_catalog.now(),'','','','');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  ('21111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111101','{"sub":"11111111-1111-4111-8111-111111111101","email":"rahulgr3001@gmail.com","email_verified":true}'::jsonb,'email',pg_catalog.now(),pg_catalog.now(),pg_catalog.now()),
  ('21111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111102','{"sub":"11111111-1111-4111-8111-111111111102","email":"gollapalliranganatha@gmail.com","email_verified":true}'::jsonb,'email',pg_catalog.now(),pg_catalog.now(),pg_catalog.now()),
  ('21111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111103','{"sub":"11111111-1111-4111-8111-111111111103","email":"ranganathaga64@gmail.com","email_verified":true}'::jsonb,'email',pg_catalog.now(),pg_catalog.now(),pg_catalog.now());

insert into public.user_profiles (id,user_id,display_name,email,role_hint) values
  ('31111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111101','Ravi Sharma','rahulgr3001@gmail.com','broker'),
  ('31111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111102','Suresh Reddy','gollapalliranganatha@gmail.com','broker'),
  ('31111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111103','Ananya Rao','ranganathaga64@gmail.com','candidate');

alter table public.organizations disable trigger assign_organization_workspace_ref;
insert into public.organizations (id,type,name,slug,status,created_by,workspace_ref,metadata) values
  ('41111111-1111-4111-8111-111111111101','matchmaker_agency','Ravi Matchmaking','ravi-matchmaking-demo','active','11111111-1111-4111-8111-111111111101','wrk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{"demo":true}'::jsonb),
  ('41111111-1111-4111-8111-111111111102','matchmaker_agency','Suresh Matrimony','suresh-matrimony-demo','active','11111111-1111-4111-8111-111111111102','wrk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','{"demo":true}'::jsonb);
alter table public.organizations enable trigger assign_organization_workspace_ref;

insert into public.organization_members (id,organization_id,user_id,role,status,invited_by) values
  ('51111111-1111-4111-8111-111111111101','41111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111101','owner','active','11111111-1111-4111-8111-111111111101'),
  ('51111111-1111-4111-8111-111111111102','41111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111102','owner','active','11111111-1111-4111-8111-111111111102');

insert into public.matchmaker_profiles (id,organization_id,display_name,slug,bio,service_regions,verification_status,metadata) values
  ('61111111-1111-4111-8111-111111111101','41111111-1111-4111-8111-111111111101','Ravi Matchmaking','ravi-matchmaking-demo','Independent matchmaking advisor for the local pilot.',array['Bengaluru','Hyderabad'],'verified','{"demo":true}'::jsonb),
  ('61111111-1111-4111-8111-111111111102','41111111-1111-4111-8111-111111111102','Suresh Matrimony','suresh-matrimony-demo','Family matchmaking practice for the local pilot.',array['Mysuru','Bengaluru'],'verified','{"demo":true}'::jsonb);

insert into public.entitlements (id,organization_id,feature_key,feature_value,source,expires_at) values
  ('71111111-1111-4111-8111-111111111101','41111111-1111-4111-8111-111111111101','brokerdesk.enabled','true'::jsonb,'local_demo',pg_catalog.now()+interval '90 days'),
  ('71111111-1111-4111-8111-111111111102','41111111-1111-4111-8111-111111111102','brokerdesk.enabled','true'::jsonb,'local_demo',pg_catalog.now()+interval '90 days');

insert into app_private.organization_business_profiles (
  organization_id,legal_name,trading_name,business_type,primary_city,primary_region,primary_country,
  representative_full_name,representative_position,representative_work_email,service_regions,
  authority_declared_at,authority_declaration_version,terms_accepted_at,terms_version
) values
  ('41111111-1111-4111-8111-111111111101','Ravi Matchmaking','Ravi Matchmaking','sole_proprietorship','Bengaluru','Karnataka','IN','Ravi Sharma','Owner','rahulgr3001@gmail.com',array['Bengaluru','Hyderabad'],pg_catalog.now(),'demo-v1',pg_catalog.now(),'demo-v1'),
  ('41111111-1111-4111-8111-111111111102','Suresh Matrimony','Suresh Matrimony','sole_proprietorship','Mysuru','Karnataka','IN','Suresh Reddy','Owner','gollapalliranganatha@gmail.com',array['Mysuru','Bengaluru'],pg_catalog.now(),'demo-v1',pg_catalog.now(),'demo-v1');

insert into app_private.organization_onboarding_states (organization_id,status,next_stage,row_version,submitted_at,approved_at) values
  ('41111111-1111-4111-8111-111111111101','approved','complete',1,pg_catalog.now(),pg_catalog.now()),
  ('41111111-1111-4111-8111-111111111102','approved','complete',1,pg_catalog.now(),pg_catalog.now());

insert into public.candidates (
  id,primary_owner_user_id,display_name,legal_name,gender,birth_date,current_city,current_region,current_country,source,status,created_by,metadata
) values (
  '81111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111103','Ananya Rao','Ananya Rao','female','1996-06-14','Bengaluru','Karnataka','India','self_signup','active','11111111-1111-4111-8111-111111111103','{"demo":true}'::jsonb
);

alter table public.broker_clients disable trigger assign_broker_client_relationship_ref;
insert into public.broker_clients (
  id,organization_id,matchmaker_profile_id,candidate_id,relationship_status,introduced_by,
  relationship_ref,relationship_source,invited_at,claimed_at,consented_at,starts_at,ends_at
) values
  ('91111111-1111-4111-8111-111111111101','41111111-1111-4111-8111-111111111101','61111111-1111-4111-8111-111111111101','81111111-1111-4111-8111-111111111103','active','11111111-1111-4111-8111-111111111101','bcr_11111111111111111111111111111111','customer_invitation',pg_catalog.now()-interval '10 days',pg_catalog.now()-interval '9 days',pg_catalog.now()-interval '9 days',pg_catalog.now()-interval '9 days',pg_catalog.now()+interval '356 days'),
  ('91111111-1111-4111-8111-111111111102','41111111-1111-4111-8111-111111111102','61111111-1111-4111-8111-111111111102','81111111-1111-4111-8111-111111111103','active','11111111-1111-4111-8111-111111111102','bcr_22222222222222222222222222222222','customer_invitation',pg_catalog.now()-interval '8 days',pg_catalog.now()-interval '7 days',pg_catalog.now()-interval '7 days',pg_catalog.now()-interval '7 days',pg_catalog.now()+interval '358 days');
alter table public.broker_clients enable trigger assign_broker_client_relationship_ref;

insert into app_private.broker_client_mandates (
  id,organization_id,broker_client_id,purpose,permitted_capabilities,evidence_reference,
  customer_approved_by,starts_at,ends_at
) values
  ('a1111111-1111-4111-8111-111111111101','41111111-1111-4111-8111-111111111101','91111111-1111-4111-8111-111111111101','Broker-assisted matchmaking pilot',array['customers.read','customers.edit_relationship','portfolio.review','introductions.create','introductions.send','introductions.record_response','introductions.close','tasks.manage','renewals.manage']::app_private.brokerdesk_capability[],'local-demo-consent-ravi','11111111-1111-4111-8111-111111111103',pg_catalog.now()-interval '9 days',pg_catalog.now()+interval '356 days'),
  ('a1111111-1111-4111-8111-111111111102','41111111-1111-4111-8111-111111111102','91111111-1111-4111-8111-111111111102','Broker-assisted matchmaking pilot',array['customers.read','customers.edit_relationship','portfolio.review','introductions.create','introductions.send','introductions.record_response','introductions.close','tasks.manage','renewals.manage']::app_private.brokerdesk_capability[],'local-demo-consent-suresh','11111111-1111-4111-8111-111111111103',pg_catalog.now()-interval '7 days',pg_catalog.now()+interval '358 days');

alter table public.portfolios disable trigger user;
alter table public.public_portfolio_snapshots disable trigger user;
alter table public.approved_portfolio_snapshots disable trigger user;

insert into public.portfolios (
  id,user_id,share_token,draft_data,published_data,template_id,theme_color,sun_sign,
  is_published,published_at,expires_at,last_renewed_at,candidate_id,public_slug,visibility_settings
) values (
  'b1111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111103','DemoCustomerLink00001',
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","last_name":"Rao","dob":"1996-06-14","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"education":{"degree":"Master of Design","institution":"National Institute of Design"},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"family":{"public_summary":"A close-knit family based in Karnataka."},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"},"contact":{"contact_person":"Demo Parent","phone":"+91 90000 00000","email":"ranganathaga64@gmail.com"}}'::jsonb,
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","last_name":"Rao","dob":"1996-06-14","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"education":{"degree":"Master of Design","institution":"National Institute of Design"},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"family":{"public_summary":"A close-knit family based in Karnataka."},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"},"contact":{"contact_person":"Demo Parent","phone":"+91 90000 00000","email":"ranganathaga64@gmail.com"}}'::jsonb,
  1,'#477B77','kanya',true,pg_catalog.now()-interval '2 days',pg_catalog.now()+interval '28 days',pg_catalog.now()-interval '2 days','81111111-1111-4111-8111-111111111103','ananya-rao-demo','{}'::jsonb
);

insert into public.public_portfolio_snapshots (
  portfolio_id,share_token,data,template_id,theme_color,sun_sign,expires_at,published_at,is_active
) values (
  'b1111111-1111-4111-8111-111111111103','DemoCustomerLink00001',
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"}}'::jsonb,
  1,'#477B77','kanya',pg_catalog.now()+interval '28 days',pg_catalog.now()-interval '2 days',true
);

insert into public.approved_portfolio_snapshots (portfolio_id,data,template_id,theme_color,sun_sign,published_at) values (
  'b1111111-1111-4111-8111-111111111103',
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","last_name":"Rao","dob":"1996-06-14","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"education":{"degree":"Master of Design","institution":"National Institute of Design"},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"family":{"public_summary":"A close-knit family based in Karnataka."},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"},"contact":{"contact_person":"Demo Parent","phone":"+91 90000 00000","email":"ranganathaga64@gmail.com"}}'::jsonb,
  1,'#477B77','kanya',pg_catalog.now()-interval '2 days'
);

alter table public.approved_portfolio_snapshots enable trigger user;
alter table public.public_portfolio_snapshots enable trigger user;
alter table public.portfolios enable trigger user;

insert into app_private.portfolio_disclosure_versions (
  id,version_ref,portfolio_id,candidate_id,version_number,public_data,complete_data,
  public_media,complete_media,horoscope,template_id,theme_color,sun_sign,published_at
) values (
  'c1111111-1111-4111-8111-111111111103','pvr_33333333333333333333333333333333','b1111111-1111-4111-8111-111111111103','81111111-1111-4111-8111-111111111103',1,
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"}}'::jsonb,
  '{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","last_name":"Rao","dob":"1996-06-14","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"education":{"degree":"Master of Design","institution":"National Institute of Design"},"career":{"title":"Senior Product Designer","location":"Bengaluru"},"family":{"public_summary":"A close-knit family based in Karnataka."},"lifestyle":{"diet":"Vegetarian","drinking":"Never","smoking":"Never","hobbies":"Classical music, hiking, and cooking"},"contact":{"contact_person":"Demo Parent","phone":"+91 90000 00000","email":"ranganathaga64@gmail.com"}}'::jsonb,
  '[]'::jsonb,'[]'::jsonb,null,1,'#477B77','kanya',pg_catalog.now()-interval '2 days'
);

insert into app_private.broker_portfolio_update_notices (
  id,notice_ref,organization_id,broker_client_id,version_id,status
) values
  ('d1111111-1111-4111-8111-111111111101','bpn_44444444444444444444444444444441','41111111-1111-4111-8111-111111111101','91111111-1111-4111-8111-111111111101','c1111111-1111-4111-8111-111111111103','acknowledged'),
  ('d1111111-1111-4111-8111-111111111102','bpn_44444444444444444444444444444442','41111111-1111-4111-8111-111111111102','91111111-1111-4111-8111-111111111102','c1111111-1111-4111-8111-111111111103','unread');

insert into app_private.broker_introductions (
  id,introduction_ref,organization_id,broker_client_id,portfolio_version_id,detailed_snapshot,
  recipient_label,status,response,response_comment,responded_at,created_by,shared_at,expires_at,row_version,created_at
) values
  ('e1111111-1111-4111-8111-111111111101','bir_55555555555555555555555555555551','41111111-1111-4111-8111-111111111101','91111111-1111-4111-8111-111111111101','c1111111-1111-4111-8111-111111111103','{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"career":{"title":"Senior Product Designer","location":"Bengaluru"}}'::jsonb,'Priya and family','responded','accepted','Please ask the broker to arrange a family call.',pg_catalog.now()-interval '4 hours','11111111-1111-4111-8111-111111111101',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '13 days',3,pg_catalog.now()-interval '1 day'),
  ('e1111111-1111-4111-8111-111111111102','bir_55555555555555555555555555555552','41111111-1111-4111-8111-111111111102','91111111-1111-4111-8111-111111111102','c1111111-1111-4111-8111-111111111103','{"privacy_mode":"balanced","personal":{"name":"Ananya Rao","first_name":"Ananya","age":30,"current_location":"Bengaluru, Karnataka, India","gender":"female","short_bio":"Product designer who values family, curiosity, and a grounded life."},"career":{"title":"Senior Product Designer","location":"Bengaluru"}}'::jsonb,'Arjun and family','shared',null,null,null,'11111111-1111-4111-8111-111111111102',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '2 days',2,pg_catalog.now()-interval '1 day');

insert into app_private.broker_introduction_passes (
  id,introduction_id,claim_token_hash,session_token_hash,claimed_at,last_seen_at,expires_at
) values
  ('f1111111-1111-4111-8111-111111111101','e1111111-1111-4111-8111-111111111101',null,pg_catalog.encode(extensions.digest(pg_catalog.convert_to(repeat('a',43),'UTF8'),'sha256'),'hex'),pg_catalog.now()-interval '20 hours',pg_catalog.now()-interval '4 hours',pg_catalog.now()+interval '13 days'),
  ('f1111111-1111-4111-8111-111111111102','e1111111-1111-4111-8111-111111111102',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(repeat('b',43),'UTF8'),'sha256'),'hex'),null,null,null,pg_catalog.now()+interval '2 days');

insert into app_private.broker_introduction_events (
  organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details,created_at
) values
  ('41111111-1111-4111-8111-111111111101','e1111111-1111-4111-8111-111111111101','created','broker','11111111-1111-4111-8111-111111111101','{}',pg_catalog.now()-interval '1 day'),
  ('41111111-1111-4111-8111-111111111101','e1111111-1111-4111-8111-111111111101','shared','broker','11111111-1111-4111-8111-111111111101','{}',pg_catalog.now()-interval '1 day'),
  ('41111111-1111-4111-8111-111111111101','e1111111-1111-4111-8111-111111111101','claimed','recipient',null,'{}',pg_catalog.now()-interval '20 hours'),
  ('41111111-1111-4111-8111-111111111101','e1111111-1111-4111-8111-111111111101','response_submitted','recipient',null,'{"response":"accepted"}',pg_catalog.now()-interval '4 hours'),
  ('41111111-1111-4111-8111-111111111102','e1111111-1111-4111-8111-111111111102','created','broker','11111111-1111-4111-8111-111111111102','{}',pg_catalog.now()-interval '1 day'),
  ('41111111-1111-4111-8111-111111111102','e1111111-1111-4111-8111-111111111102','shared','broker','11111111-1111-4111-8111-111111111102','{}',pg_catalog.now()-interval '1 day');

commit;
