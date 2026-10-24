// @ts-check
/** Shared by the build and runtimes; never accepts an arbitrary telemetry destination. */
/** @param {string | undefined} dsn */
export function sentryIngestOrigin(dsn) {
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" &&
      /^o\d+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(url.hostname) &&
      /^[a-f0-9]{32}$/.test(url.username) && !url.password && !url.port &&
      /^\/\d+$/.test(url.pathname) && !url.search && !url.hash
      ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string | undefined} env @param {string | undefined} fallback */
export function sentryEnvironment(env, fallback) {
  return env && /^(development|preview|production|test)$/.test(env) ? env
    : fallback === "production" ? "production" : "development";
}
