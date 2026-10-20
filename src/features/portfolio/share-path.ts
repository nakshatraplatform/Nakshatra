import { z } from "zod/v4";

/** Validates readable paths and legacy identifiers; never authorizes Complete access. */
export const portfolioSharePathSchema = z.string().min(3).max(160).regex(/^[A-Za-z0-9_-]+$/);
