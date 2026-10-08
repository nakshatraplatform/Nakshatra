import { z } from "zod/v4";
/** Shared server/worker dispatch validation, never an authorization proof. */
export const emailMessageSchema = z.object({
    deliveryId: z.uuid(),
    to: z.email().max(254),
    subject: z.string().trim().min(1).max(200).regex(/^[^\r\n\u0000-\u001f\u007f]+$/),
    text: z.string().min(1).max(32_768).refine((value) => value.trim().length > 0),
    html: z.string().min(1).max(65_536).optional(),
}).strict();
