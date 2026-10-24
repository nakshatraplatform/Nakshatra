// @ts-check
import { captureException, startSpan, withScope } from "@sentry/core";
import { approvedOperation, approvedCode, approvedReference } from "./operation-contract.mjs";

/** Report deliberately handled failures without letting telemetry change business outcomes.
 * @param {string} operation @param {unknown} error
 * @param {{ code?: unknown, reference?: unknown }} [details]
 */
export function reportOperationFailure(operation, error, details = {}) {
  try {
    const reference = approvedReference(details.reference);
    captureException(error instanceof Error ? error : new Error("OPERATION_FAILED"), {
      tags: { "vivintro.operation": approvedOperation(operation) ?? "server.error", "vivintro.code": approvedCode(details.code),
        ...(reference ? { "vivintro.reference": reference } : {}) },
    });
  } catch { /* An unavailable diagnostic sink cannot fail a save, proof or cleanup. */ }
}

/** Scope labels propagate to real SDK child spans, never to outgoing HTTP headers.
 * @template T @param {string} operation @param {() => T} run @returns {T}
 */
export function observeOperation(operation, run) {
  const label = approvedOperation(operation);
  if (!label) return run();
  return withScope(scope => {
    scope.setAttribute("vivintro.operation", label);
    return startSpan({ name: label, op: "function", attributes: { "vivintro.operation": label } }, run);
  });
}
