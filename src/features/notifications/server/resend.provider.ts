import "server-only";

import { z } from "zod/v4";
import { emailMessageSchema, type EmailDispatchResult, type EmailFailureCode } from "./email.contract";

const configSchema = z.object({
  apiKey: z.string().min(1).max(512).regex(/^[\x21-\x7e]+$/),
  from: z.email().max(254),
  replyTo: z.email().max(254).optional(),
});
const acceptedSchema = z.object({ id: z.uuid() });
const errorSchema = z.object({ name: z.string().max(80) });
const responseByteLimit = 16_384;
const timeoutMs = 10_000;

function failure(code: EmailFailureCode, retryable = false): EmailDispatchResult {
  return { status: "failed", code, retryable };
}

/** Bounds even chunked responses; bodies never reach logs or returned errors. */
async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    if (signal.aborted) return null;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > responseByteLimit) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    // Do not let a broken upstream delay timeout/error cleanup.
    signal.removeEventListener("abort", cancel);
    cancel();
  }
}

function classify(status: number, body: unknown): EmailDispatchResult {
  if (status === 401 || status === 403) return failure("EMAIL_CREDENTIALS_REJECTED");
  if (status === 429) return failure("EMAIL_RATE_LIMITED", true);
  if (status === 408 || status >= 500) return failure("EMAIL_PROVIDER_UNAVAILABLE", true);
  if (status === 409) {
    const error = errorSchema.safeParse(body);
    return error.success && error.data.name === "concurrent_idempotent_requests"
      ? failure("EMAIL_PROVIDER_UNAVAILABLE", true)
      : failure("EMAIL_IDEMPOTENCY_CONFLICT");
  }
  return failure("EMAIL_REJECTED");
}

/** Makes one bounded Resend attempt for a trusted server caller; accepted is not delivered. */
export async function sendResendEmail(input: unknown, transport: typeof fetch = fetch): Promise<EmailDispatchResult> {
  const message = emailMessageSchema.safeParse(input);
  if (!message.success) return failure("EMAIL_INPUT_INVALID");

  // Resolve at dispatch, not module evaluation: builds need no mail credentials.
  const config = configSchema.safeParse({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
    replyTo: process.env.RESEND_REPLY_TO_EMAIL || undefined,
  });
  if (!config.success) return failure("EMAIL_NOT_CONFIGURED");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<EmailDispatchResult>((resolve) => {
    timer = setTimeout(() => {
      resolve(failure("EMAIL_TIMEOUT", true));
      controller.abort();
    }, timeoutMs);
  });
  const dispatch = async (): Promise<EmailDispatchResult> => {
    try {
      const response = await transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.data.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `notification/${message.data.deliveryId}`,
        },
        body: JSON.stringify({
          from: config.data.from,
          to: [message.data.to],
          subject: message.data.subject,
          text: message.data.text,
          ...(message.data.html ? { html: message.data.html } : {}),
          ...(config.data.replyTo ? { reply_to: config.data.replyTo } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      const body = await readResponse(response, controller.signal);
      if (!response.ok) return classify(response.status, body);
      const accepted = acceptedSchema.safeParse(body);
      return accepted.success
        ? { status: "accepted", providerMessageId: accepted.data.id }
        : failure("EMAIL_RESPONSE_INVALID", true);
    } catch {
      return failure("EMAIL_PROVIDER_UNAVAILABLE", true);
    }
  };
  try {
    return await Promise.race([dispatch(), deadline]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
