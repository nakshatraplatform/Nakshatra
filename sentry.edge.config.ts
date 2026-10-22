import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/lib/observability/sentry";

Sentry.init(sentryOptions());
