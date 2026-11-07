import "server-only";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workspaceRefSchema } from "@/features/security/public-reference";
import {
  introductionActionSchema, introductionShareCommandSchema, introductionShareResultSchema,
  introductionWorkspaceListSchema, introductionWorkspacePathSchema, introductionWorkspaceQuerySchema,
} from "./introduction-workspace.contract";
import { BrokerIntroductionRepository } from "./broker-introduction.repository";
import { BrokerIntroductionError } from "./broker-introduction.service";

function resultOrError<T>(schema: z.ZodType<T>, result: { data: unknown; error: { code?: string } | null }): T {
  if (result.error) {
    const status = result.error.code === "22023" ? 400
      : ["40001", "54000", "23505"].includes(result.error.code || "") ? 409 : 503;
    throw new BrokerIntroductionError(
      status === 409 ? "This action changed or is not available yet. Refresh and try again."
        : "The Introduction action could not be completed.",
      "BROKER_INTRODUCTION_ACTION_UNAVAILABLE", status
    );
  }
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) throw new BrokerIntroductionError(
    "Introduction actions are temporarily unavailable.", "BROKER_INTRODUCTION_ACTION_INVALID", 503
  );
  return parsed.data;
}

export async function resolveIntroductionAction(supabase: SupabaseClient, input: unknown) {
  const path = introductionWorkspacePathSchema.parse(input);
  const result = await new BrokerIntroductionRepository(supabase).actionWorkspace(path.workspaceRef, path.introductionRef);
  return resultOrError(introductionActionSchema, result);
}

export async function recordIntroductionShareAction(supabase: SupabaseClient, pathInput: unknown, commandInput: unknown) {
  const path = introductionWorkspacePathSchema.parse(pathInput);
  const command = introductionShareCommandSchema.parse(commandInput);
  const result = await new BrokerIntroductionRepository(supabase).recordShareAction(path.workspaceRef, path.introductionRef, command);
  return resultOrError(introductionShareResultSchema, result);
}

export async function resolveIntroductionWorkspaceList(supabase: SupabaseClient, workspaceRef: string, queryInput: unknown = {}) {
  const workspace = workspaceRefSchema.parse(workspaceRef);
  const query = introductionWorkspaceQuerySchema.parse(queryInput);
  const result = await new BrokerIntroductionRepository(supabase).actionList(workspace, query);
  return resultOrError(introductionWorkspaceListSchema, result);
}
