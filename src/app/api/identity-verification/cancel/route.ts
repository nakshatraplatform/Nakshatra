import { candidateRecoveryRoute } from "@/features/identity-verification/server/candidate-recovery.route";
export function POST(request: Request) { return candidateRecoveryRoute(request, "cancel"); }
