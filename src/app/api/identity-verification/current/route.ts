import { candidateRecoveryRoute } from "@/features/identity-verification/server/candidate-recovery.route";
export function GET(request: Request) { return candidateRecoveryRoute(request, "current"); }
