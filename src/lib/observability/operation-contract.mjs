// @ts-check
// Only code-owned diagnostic vocabulary may cross the telemetry boundary.
const operations = new Set([
  "verification.status", "verification.retry", "verification.withdraw", "verification.webhook",
  "account.deletion_reauth.callback_failed", "account.deletion_reauth.start_failed", "auth.callback.failed",
  "auth.portfolio.bootstrap_failed", "auth.start.failed", "auth.verify.failed",
  "brokerdesk.customer.invitation_create_failed", "brokerdesk.customer_read_failed", "brokerdesk.customers_read_failed",
  "brokerdesk.reauth.mfa_completion_failed", "brokerdesk.reauth.start_failed", "brokerdesk.representative_verification.start_failed",
  "brokerdesk.team.access_replace_failed", "brokerdesk.team.invitation_accept_failed", "brokerdesk.team.invitation_create_failed",
  "brokerdesk.team.invitation_exchange_failed", "brokerdesk.team.read_failed", "brokerdesk.team.suspend_failed",
  "customer.broker_consent_change_failed", "customer.broker_invitation_claim_failed", "customer.broker_invitation_exchange_failed",
  "customer.broker_relationships_read_failed", "identity_verification.email_dispatch_failed", "maintenance.accountDeletion",
  "maintenance.photoCleanup", "maintenance.emailRetention", "maintenance.expiryReminders", "maintenance.horoscopeCleanup",
  "maintenance.identity", "maintenance.livenessEmail", "maintenance.providerCleanup",
  "maintenance.relationshipEmail", "maintenance.retention", "portfolio.dashboard.load",
  "portfolio.draft.save", "portfolio.publish", "production_maintenance.failed",
  "provider.didit.request", "provider.resend.send", "relationship_notifications.process_failed",
  "server.error", "verification.cancel", "verification.check-result",
  "verification.current", "verification.resume", "verification.start",
  "worker.account-deletion", "worker.broker-introductions", "worker.identity-verification",
  "worker.retention",
]);
const codes = new Set([
  "DIDIT_WEBHOOK_UNAVAILABLE",
  "LIVENESS_EMAIL_DISPATCH_FAILED", "MAINTENANCE_CLAIM_FAILED", "MAINTENANCE_COMPLETION_FAILED",
  "EXPIRY_REMINDER_ENQUEUE_FAILED", "PHOTO_CLEANUP_CLAIM_FAILED", "PHOTO_CLEANUP_COMPLETION_FAILED",
  "ACCOUNT_DELETION_WORK_DEFERRED", "DASHBOARD_DATABASE_UPDATE_REQUIRED", "DASHBOARD_SAVE_FAILED",
  "DELETED_PROVIDER_WORK_DEFERRED", "DIDIT_CREDENTIALS_INVALID", "DIDIT_CREDITS_UNAVAILABLE",
  "DIDIT_DECISION_FETCH_FAILED", "DIDIT_DECISION_INVALID", "DIDIT_DECISION_MISMATCH",
  "DIDIT_DECISION_REQUIRED_CHECK_MISSING", "DIDIT_DECISION_STATUS_INVALID", "DIDIT_DECISION_UNEXPECTED_CHECKS",
  "DIDIT_HOSTED_URL_INVALID", "DIDIT_PROVIDER_REJECTED", "DIDIT_PROVIDER_UNAVAILABLE",
  "DIDIT_RATE_LIMITED", "DIDIT_REQUEST_TIMEOUT", "DIDIT_RESPONSE_TOO_LARGE",
  "DIDIT_SESSION_MISSING", "DIDIT_SESSION_PURGE_FAILED", "DIDIT_SESSION_RECOVERY_FAILED",
  "DIDIT_SESSION_RECOVERY_INVALID", "DIDIT_SESSION_RECOVERY_MISMATCH", "DIDIT_SESSION_RECOVERY_PENDING",
  "DIDIT_SESSION_REFERENCE_MISSING", "DIDIT_WORKFLOW_MISMATCH", "EMAIL_CREDENTIALS_REJECTED",
  "EMAIL_DELIVERY_GUARD_UNAVAILABLE", "EMAIL_IDEMPOTENCY_CONFLICT", "EMAIL_INPUT_INVALID",
  "EMAIL_NOT_CONFIGURED", "EMAIL_PROVIDER_UNAVAILABLE", "EMAIL_RATE_LIMITED",
  "EMAIL_RECIPIENT_SUPPRESSED", "EMAIL_REJECTED", "EMAIL_RESPONSE_INVALID",
  "EMAIL_RETRY_WINDOW_EXPIRED", "EMAIL_TIMEOUT", "IDENTITY_VERIFICATION_CLAIM_FAILED",
  "IDENTITY_VERIFICATION_CONFIGURATION_INVALID", "IDENTITY_VERIFICATION_DEFERRAL_FAILED", "IDENTITY_VERIFICATION_EXPIRY_FAILED",
  "IDENTITY_VERIFICATION_METHOD_INVALID", "IDENTITY_VERIFICATION_PROCESSING_FAILED", "IDENTITY_VERIFICATION_PROVIDER_CLEANUP_FAILED",
  "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID", "IDENTITY_VERIFICATION_PROVIDER_CORRELATION_INVALID", "IDENTITY_VERIFICATION_PROVIDER_CREDENTIALS",
  "IDENTITY_VERIFICATION_PROVIDER_CREDITS", "IDENTITY_VERIFICATION_PROVIDER_RATE_LIMITED", "IDENTITY_VERIFICATION_PROVIDER_REJECTED",
  "IDENTITY_VERIFICATION_PROVIDER_SESSION_MISSING", "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT", "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE",
  "IDENTITY_VERIFICATION_RECONCILIATION_COMPLETION_FAILED", "IDENTITY_VERIFICATION_RECOVERY_COMPLETION_FAILED", "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE",
  "IDENTITY_VERIFICATION_REDACTION_COMPLETION_FAILED", "IDENTITY_VERIFICATION_REQUEST_FAILED", "IDENTITY_VERIFICATION_START_FAILED",
  "IDENTITY_VERIFICATION_STATE_CONFLICT", "IDENTITY_VERIFICATION_SUBJECT_TYPE_INVALID", "IDENTITY_VERIFICATION_WORK_DEFERRED",
  "IDENTITY_VERIFICATION_WORK_SCOPE_INVALID", "IDENTITY_VERIFICATION_WORK_TYPE_INVALID", "LIVENESS_EMAIL_DELIVERY_DEFERRED",
  "OPERATION_FAILED", "PORTFOLIO_PUBLISH_FAILED", "RATE_LIMIT_EXCEEDED",
  "RATE_LIMIT_UNAVAILABLE", "TASK_DEFERRED", "TASK_FAILED",
]);

/** @param {unknown} value */
export function approvedOperation(value) { return typeof value === "string" && operations.has(value) ? value : undefined; }
/** @param {unknown} value */
export function approvedCode(value) { return typeof value === "string" && codes.has(value) ? value : "OPERATION_FAILED"; }
/** @param {unknown} value */
export function approvedReference(value) { return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : undefined; }
