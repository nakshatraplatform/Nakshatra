import type { PilotAccessState, SubmitPilotAccessCommand } from "../server/pilot-access.contract";

type ApiFailure = { code?: string; error?: string };

async function readBody<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

export async function getPilotAccessState() {
  try {
    const response = await fetch("/api/pilot-access", { cache: "no-store" });
    return {
      ok: response.ok,
      unauthenticated: response.status === 401,
      state: response.ok ? await readBody<PilotAccessState>(response) : null,
      failure: response.ok ? null : await readBody<ApiFailure>(response),
    };
  } catch {
    return {
      ok: false,
      unauthenticated: false,
      state: null,
      failure: { error: "We could not connect. Check your internet connection and try again." },
    };
  }
}

export async function submitPilotAccess(command: SubmitPilotAccessCommand) {
  try {
    const response = await fetch("/api/pilot-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    return {
      ok: response.ok,
      state: response.ok ? await readBody(response) : null,
      failure: response.ok ? null : await readBody<ApiFailure>(response),
    };
  } catch {
    return {
      ok: false,
      state: null,
      failure: { error: "We could not connect. Check your internet connection and try again." },
    };
  }
}
