import { pathToFileURL } from "node:url";

/** Validate the development-only deployment boundary before linking any database. */
export function checkDevelopmentDatabaseTarget(env) {
  if (env.GITHUB_REF !== "refs/heads/development") {
    throw new Error("Development database deployment requires the development branch");
  }
  if (env.DEVELOPMENT_DATABASE_ENABLED !== "true") {
    throw new Error("Development database deployment is not enabled");
  }
  const expected = env.EXPECTED_DEVELOPMENT_PROJECT_REF;
  const actual = env.SUPABASE_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(expected ?? "") || actual !== expected) {
    throw new Error("Development Supabase project must match the approved project reference");
  }
  if (actual === "xizzzczzhqzabcipbgep") {
    throw new Error("Production Supabase project is forbidden for development deployment");
  }
  for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"]) {
    if (typeof env[name] !== "string" || !env[name].trim()) {
      throw new Error(`Missing development deployment credential: ${name}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkDevelopmentDatabaseTarget(process.env);
    console.log("Development database target validated");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
