# Production maintenance activation and recovery

Applies to NAK-74's personal portfolio readiness work. This is an operator runbook;
no production migrations, provider deletions, real email retries or schedules were
activated during local implementation.

## Deploy and activate

1. Review and deploy the four October 17 migrations and matching application.
   Migration installation leaves the named `vivintro-production-maintenance`
   Supabase Cron job dormant: private database state defaults to disabled.
   Confirm pg_cron, pg_net and Vault are available in the target project.
2. Configure Vercel production with the existing server-only Supabase service
   credential, Didit API key and document-free workflow ID, Resend credentials and
   sender settings, and `NEXT_PUBLIC_APP_URL=https://www.vivintro.com`.
   Add a new random `PRODUCTION_WORKER_SECRET` (at least 32 ASCII characters)
   and `PRODUCTION_WORKER_ENABLED=true`. Redeploy. Keep the secret out of logs,
   commands recorded in shell history, tickets and public/client environment vars.
3. Through a protected service-role operator connection, call
   `configure_production_worker_schedule(p_secret, true)` with the same secret.
   It stores/rotates it in Vault; scheduled requests carry a 60-second action-scoped HMAC and a durably consumed one-use nonce, never the permanent secret; only the fixed production maintenance endpoint
   can be dispatched. Prefer a parameterized service RPC client. Do not paste a
   literal secret into a saved SQL file or a public issue.
4. Send one authenticated POST to `/api/internal/production-maintenance` and
   inspect aggregate task results; HTTP 503 means deferred work or persistence
   failure. A skipped batch can mean a live lease or disabled database configuration.
   A live batch lease lasts four minutes; scheduler signatures expire after 60 seconds (10 seconds future clock skew is allowed), and consumed nonce IDs are retained privately for ten minutes to reject replays; individual job claims remain fenced.
5. Connect an **independent uptime monitor** to authenticated GET
   `/api/internal/production-health` every five minutes. Alert the operators on
   a non-200 result, unreachable endpoint or a missing monitor result. The endpoint
   becomes unhealthy after 15 minutes without a successful batch, after any failed
   batch, an overdue identity/deleted-provider queue, or overdue/held relationship
   mail. No addresses, media paths or provider/session IDs are returned.
   The included `Production Maintenance Health` GitHub workflow is a secondary
   ten-minute watchdog: set repository variable `PRODUCTION_WORKER_ENABLED=true`
   and the matching environment secret in `production`. It opens one actionable
   operational issue on unhealthy results. GitHub scheduling can also be delayed,
   so it does not replace the independent monitor or establish a hard alert SLA.
6. Observe at least six scheduled runs over 30 minutes with real run timestamps,
   queue counts and monitor alert/recovery evidence. Test an intentionally paused
   scheduler in staging; confirm the monitor detects absence, not just failed runs.
   GitHub cron is a recovery path and cannot demonstrate the primary cadence.
7. Review existing notification quarantine before declaring readiness. Do not
   treat a successful empty worker as evidence that historical cleanup or mail
   delivery completed. Acceptance of a liveness result is independent of delivery.

The application endpoint runs bounded batches concurrently across independent
queues (candidate identity 2, deleted-provider cleanup 2, liveness mail 2,
relationship mail 5, account deletion 1). Each transport request has a 10-second
limit and the batch has a 150-second transport deadline. It records a safe
completion even when another task fails. The endpoint's deployment duration is
180 seconds; verify the actual hosting limit supports that before activation.
Per-record claims prevent overlap with the existing GitHub worker.

Disable through `configure_production_worker_schedule(null, false)` and set the
Vercel flag false to stop new dispatch. Let current leases drain. Do not roll back
by restoring direct viewer Storage policies. Before rolling back application code,
keep a compatible trusted signing path or fail closed for protected media.

## Relationship mail review

Automatic uncertain retries stop at **23 hours from first attempt**, leaving
margin before Resend's 24-hour idempotency retention. Reclaimed leases preserve
that clock. Unattempted events older than 24 hours are held for stale-intent review.
These rules apply to relationship messages, not the separate pilot-access outbox.

Use a protected operator connection to inspect only the specific notification
reference, event age, safe error code and current relationship. Confirm the event
still makes sense and reconcile Resend's recorded acceptance before retrying an
uncertain delivery. Re-rendering uses the current recipient and current grant;
expired or revoked grants cannot produce a fresh access-granted email.

- `requeue_failed_relationship_notification(ref, false)` refuses stale/uncertain
  recovery. After reviewing current intent and provider logs, explicit `true`
  acknowledges duplicate-delivery risk and releases **that one message**.
- `suppress_failed_relationship_notification(ref)` retires obsolete delivery
  without sending it. It retains a durable `OPERATOR_SUPPRESSED` disposition;
  it is never counted as provider acceptance and cannot be bulk requeued.
- Bulk recovery accepts only recent known-safe failures. It does not release
  quarantine or reset the durable first-attempt clock.

The ten old production messages have **not** been replayed or suppressed here.
A deployment must quarantine them first, then operators must decide per message.

## Deleted-account provider cleanup

A private FK-independent queue captures minimum provider correlation before any
attempt/subject/account cascade. Account erasure can continue while the independent
queue retains only what is necessary to complete provider deletion. Confirmed
purge deletes that correlation. Do not retain camera evidence in this queue.

Workers validate session UUID, workflow/version and exact vendor correlation
before deleting. No discovered session, multiple/paginated sessions, legacy
missing correlation, provider errors, 404 or retained embeddings do **not** count
as purge proof. The queue remains durable and health alerts remain actionable.
Reconcile these cases with Didit/provider support through a protected operator
process; do not clear jobs or fabricate success simply to turn monitoring green.
The automatic worker cannot retrospectively recover references already deleted
before this migration. Historical reconciliation requires separate provider evidence.

## Storage proof and residual access

Approved viewers resolve allowed descriptors with their authenticated session.
Only the server signs protected bytes, with TTL capped to 300 seconds and the
remaining grant time. Owner upload/preview and public derivatives retain their
existing policies. Browser users cannot choose a protected signing path or TTL.

Previously issued bearer URLs remain usable until expiry. Revocation blocks new
authorization; it does not recall already downloaded bytes or immediately revoke
old signed URLs, including long-lived URLs issued before rollout. Assess previously
issued capabilities separately; never promise immediate byte recall.

`scripts/verify-protected-storage.mjs` is an isolated **loopback-only** proof for
project `nak74-readiness` on port 55421. Supply its local JWT/anon/service values
through process environment, never production keys. It creates and removes fixed
synthetic fixtures and tests real Storage upload/sign/retrieval/revocation/expiry.
It temporarily disables the audit mutation trigger only for synthetic cleanup
inside that disposable database; this is not an application or production path.

## Repository controls and container

Apply and independently verify [main/environment protections](../branch-protection.md)
with an administrator. Database CI was already required; keep it required.
Docker now uses Node 24 LTS throughout and copies the local locked lint dependency
before npm install. Full image build/start and deployment platform runtime are
separate evidence; Docker's prior Node 20 incompatibility was not evidence of a
Vercel runtime defect.


## Expanded retention and horoscope cleanup

The maintenance endpoint now runs all seven current application retention classes in separate service-role transactions, up to 500 eligible rows per class per five-minute batch. A failing class cannot roll back another class. The operator `privacy:retention` command keeps its response keys but now performs bounded batches: repeat while health reports overdue rows. The first production backlog drain needs explicit authorization because it deletes real records.

Health includes `retention.<class>.lastSucceededAt`, `lastAffected`, and `overdue`. Missing success for 15 minutes or any overdue class makes health fail. These are independent of identity/email success; empty successful checks still count. The API-counter cutoff remains two days from last update. Sessions use 90 days; views/events 395; access audits 730; eligible rejected/closed request fields 180; completed receipts their deadline, orphaned receipts 30 days. Backups and other audit classes are not proved by this worker.

Horoscope uploads reserve server-generated object paths before Storage I/O. The owner CAS command atomically replaces the expected pointer and queues obsolete objects. Direct browser table writes are revoked; ambiguous commit failures never delete possibly live objects. Five-minute maintenance claims up to five abandoned/retired objects, retries safely on Storage failures and fences completions with leases. Abandoned uploads become eligible after one hour. Queues have no parent FK, so account deletion cannot erase cleanup work. An attachment referencing an immutable disclosure version is held until that parent lifecycle releases it; this change does not reinterpret BrokerDesk historical disclosure access. Active references are never treated as orphan files. Invalid historical paths require operator review rather than arbitrary deletion.

Rollout: apply the three expanded-readiness migrations before deploying the dependent application. Check granted RPCs and revoked direct writes; validate synthetic upload/replace/delete and retention in staging. Enable the previously documented primary maintenance scheduler and matching application environment only after the endpoint is deployed. Read health after the first authorized run and confirm each class has a fresh success and zero overdue rows. Investigate failed/held cleanup rather than deleting queue rows. Production cleanup, provider delivery, physical-device assistive technology and external search-engine deindexing are separate evidence.


Compatibility note: the horoscope migration revokes direct browser table writes, so the old application upsert cannot continue during a rolling transition. Coordinate a short horoscope-write pause while switching schema/application versions. Keep the guarded commands and cleanup queue on rollback; do not restore the unsafe stale-row recovery behavior. This has not been applied to production by this implementation task.


Retention correction: the pending expanded migration clears both message columns (`message` and `request_reason`) atomically. Selection, remaining counts and overdue health use one private eligibility rule. Older rejected/closed rows matching the exact prior partial-erasure signature are eligible for repair despite a reset `updated_at`, provided `created_at` is older than 180 days. Current/open/approved requests retain their normal retention rules. Explicit full personal-detail erasure, including account deletion, also clears the duplicate via a private trigger regardless of status. This does not shorten access-grant expiry or delete submitted requests at their 15-day access deadline. Validate both newly eligible and already partially erased synthetic records in staging before authorizing the real backlog drain. Full clean local Supabase replay of the final correction now passes, with 57 suites/1,534 assertions, schema lint, security advisors and generated-type comparison. Production installation and actual authorized backlog cleanup still require their own verification.

## Personal Complete Portfolio expiry reminders (NAK-66)

The matching reminder migration/app adds an eighth maintenance result,
`expiryReminders`. It enqueues at most 25 due grants / 50 owner-and-viewer messages
per run before relationship-email claims. An enqueue failure marks the batch
unhealthy while existing mail and all other maintenance still run. The protected
health endpoint additionally reports `expiryReminders.oldestUnqueuedAt`; missing
production for more than 15 minutes is unhealthy even if the outbox is empty.

Each current grant gets at most one message per recipient and exact expiry
period during its final 24 hours. A renewal invalidates old unsent messages;
revocation, expiration, unavailable publication and changed/unverified recipients
also retire them. The canonical publication predicate is reused. Retired work
has expiry-only `skipped` status, no acceptance timestamp and no permanent failed
health count. Previously failed/quarantined messages remain operator-owned.

Before the provider call, the current lease, grant and intended recipient are
rechecked. A digest binds the exact rendered recipient/subject/text; no raw address
or body is added to the queue. Configuration (public origin, sender and Reply-To)
must remain stable during uncertain retries. A changed rendered request is
skipped rather than reused under the old delivery key. Legacy attempted reminder
work without a request digest is retired conservatively; old sent date keys are
honored and no blind historical replay occurs. Only provider acceptance is
recorded as sent. Accepted messages cannot be recalled after renewal/revocation;
the linked application still enforces current permissions.

The unchanged five-message scheduled batch reserves three slots for ordinary
relationship mail and two for earliest-expiring reminders when both backlogs
exist; either pool uses spare capacity. Smaller operator batches reserve both
pools where possible; a size-one batch alternates its preferred pool by UTC
minute. Nominal empty-queue capacity remains 60 messages per hour at five-minute
cadence, before retries/provider limits. Two reminders are generated per grant;
monitor backlog and earliest expiry before increasing batches. Production-volume
capacity and end-to-end delivery are not established by synthetic tests.

Rollout: pause all relationship-email dispatchers, apply the forward migration,
deploy matching app/worker code, verify active schedule and sender settings, then
resume dispatch through the existing protected operator procedure. Installation
must not automatically enable the primary schedule. The prior app does not
perform reminder preparation, so rolling it back requires pausing dispatch first.
Use synthetic staging accounts to verify both inboxes, exact UTC expiry, current
access and obsolete-job skip. Keep NAK-82 inbox evidence separate from unit/SQL
checks. BrokerDesk policy, Auth SMTP and delivery webhooks are unchanged.

Reminder recovery note: a preparation RPC outage occurs before the provider call.
`REMINDER_PREPARE_FAILED` is accepted by existing recent safe-recovery commands;
retry windows and first-attempt clocks still apply. Obsolete backlog is retired
in bounded 100-row sweeps, so a large expired backlog may need multiple batches.
Overflow remains queued for those sweeps rather than creating failed-mail alerts.
