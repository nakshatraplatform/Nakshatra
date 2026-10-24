import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/lib/observability/sentry.runtime.mjs";

Sentry.init(sentryOptions());
