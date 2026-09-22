-- Exact birth time remains Complete Portfolio data. Re-define the immutable
-- Broker Standard projector forward-only so environments that already applied
-- the original projector also remove this sensitive field.
create or replace function app_private.build_broker_standard_profile(p_complete_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'privacy_mode', p_complete_data -> 'privacy_mode',
    'personal', app_private.pick_jsonb_keys(p_complete_data -> 'personal', array[
      'name','first_name','middle_name','last_name','dob','age','place_of_birth',
      'current_location','gender','marital_status','immigration_status',
      'relocation_preference','short_bio','profile_summary','country','region',
      'city','citizenship','religion','community','sub_community',
      'long_term_goals','shared_life_plans'
    ]::text[]),
    'vitals', app_private.pick_jsonb_keys(p_complete_data -> 'vitals', array[
      'height','gotra'
    ]::text[]),
    'astrology', app_private.pick_jsonb_keys(p_complete_data -> 'astrology', array[
      'rashi','nakshatra','pada','lagnam','manglik_status','maternal_gotra'
    ]::text[]),
    'education', app_private.pick_jsonb_keys(p_complete_data -> 'education', array[
      'degree','institution','year','location','summary','qualification_level'
    ]::text[]),
    'career', app_private.pick_jsonb_keys(p_complete_data -> 'career', array[
      'title','company','location','summary','job_type','career_goals'
    ]::text[]),
    'family', app_private.pick_jsonb_keys(p_complete_data -> 'family', array[
      'father','mother','siblings','ancestral_origin','paternal_origin',
      'maternal_origin','public_summary','current_settlement','family_note',
      'sibling_count','sibling_position','parents_location','current_country',
      'current_region','current_city','family_spread'
    ]::text[]),
    'lifestyle', app_private.pick_jsonb_keys(p_complete_data -> 'lifestyle', array[
      'hobbies','languages','diet','smoking','drinking','values_statement'
    ]::text[]),
    'preferences', app_private.pick_jsonb_keys(p_complete_data -> 'preferences', array[
      'narrative','age_range','height_range','marital_status','background',
      'visa_preferences','caste_preference','specific_communities',
      'horoscope_preference','marriage_timeline','children_preference',
      'career_after_marriage','living_arrangement','family_responsibilities',
      'religion_preference','lifestyle_expectations','education_expectations',
      'career_expectations'
    ]::text[]),
    'style', app_private.pick_jsonb_keys(p_complete_data -> 'style', array[
      'appearance','template_name'
    ]::text[])
  ))
$$;

revoke all on function app_private.build_broker_standard_profile(jsonb)
  from public, anon, authenticated;

-- Stored snapshots are projections, not customer-authored source data. Rebuild
-- them deterministically so previously pinned introductions cannot retain the
-- sensitive field after this migration.
update app_private.portfolio_disclosure_versions
set broker_standard_data = app_private.build_broker_standard_profile(complete_data);
