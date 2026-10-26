import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/observability/sentry.runtime.mjs";

Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
