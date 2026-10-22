-- Add enum values in their own migration. PostgreSQL requires newly-added enum
-- values to be committed before a later transaction can safely use them.

alter type app_private.brokerdesk_capability
  add value if not exists 'family_viewers.propose';

alter type app_private.brokerdesk_capability
  add value if not exists 'introductions.manage_sharing';

alter type app_private.brokerdesk_capability
  add value if not exists 'introductions.record_family_update';
