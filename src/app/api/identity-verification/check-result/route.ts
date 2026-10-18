import { candidateRecoveryRoute } from "@/features/identity-verification/server/candidate-recovery.route";
export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(request: Request) { return candidateRecoveryRoute(request, "check-result"); }
