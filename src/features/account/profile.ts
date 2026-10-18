import { z } from "zod";
import type { User } from "@supabase/supabase-js";

const name = z.string().trim().max(80).refine((value) => !/[\u0000-\u001f\u007f<>]/u.test(value), "Enter a name without control characters or markup.");
export const accountProfileSchema = z.object({ firstName: name.pipe(z.string().min(1)), middleName: name, lastName: name.pipe(z.string().min(1)) }).strict();
export type AccountProfile = z.infer<typeof accountProfileSchema>;
export const emptyAccountProfile: AccountProfile = { firstName: "", middleName: "", lastName: "" };

/** Account-holder names are independent of the portfolio and never authorize access. */
export function readAccountProfile(user: Pick<User, "user_metadata">): AccountProfile {
  const metadata = user.user_metadata ?? {};
  const read = (key: string) => typeof metadata[key] === "string" ? metadata[key].slice(0, 80) : "";
  return { firstName: read("account_first_name"), middleName: read("account_middle_name"), lastName: read("account_last_name") };
}

/** Report linked providers, not an inferred current-session authentication method. */
export function accountSignInMethods(user: Pick<User, "identities">): string[] {
  return [...new Set((user.identities ?? []).map(({ provider }) => provider === "google" ? "Google" : provider === "email" ? "Email" : "Other sign-in provider"))];
}
