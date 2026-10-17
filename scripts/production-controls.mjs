import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REPOSITORY = "nakshatraplatform/Nakshatra";
export function protectedRuleset(current) {
  const payload = Object.fromEntries(["name", "target", "enforcement", "conditions", "rules", "bypass_actors"].filter(k => current[k] != null).map(k => [k, structuredClone(current[k])]));
  if (payload.target !== "branch" || !payload.conditions?.ref_name?.include?.includes("~DEFAULT_BRANCH")) throw new Error("Unexpected main ruleset");
  const review = payload.rules.find(rule => rule.type === "pull_request");
  if (!review) throw new Error("Main pull-request rule missing");
  review.parameters.required_approving_review_count = Math.max(1, review.parameters.required_approving_review_count);
  review.parameters.dismiss_stale_reviews_on_push = true;
  review.parameters.require_last_push_approval = true;
  review.parameters.required_review_thread_resolution = true;
  payload.enforcement = "active";
  return payload;
}

function api(path, method = "GET", payload) {
  return JSON.parse(execFileSync("gh", ["api", `repos/${REPOSITORY}${path ? `/${path}` : ""}`, "--method", method,
    ...(payload ? ["--input", "-"] : [])], { input: payload ? JSON.stringify(payload) : undefined, encoding: "utf8" }));
}

export function configureProductionControls(apply = false) {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  if (!/^((git@github.com:)|(https:\/\/github.com\/))nakshatraplatform\/Nakshatra(?:\.git)?$/.test(remote)) throw new Error("Repository mismatch");
  const repository = api("");
  if (apply && repository.permissions?.admin !== true) throw new Error("Repository administration permission required; no controls changed");
  if (repository.default_branch !== "main") throw new Error("Unexpected default branch");
  const matches = api("rulesets").filter(rule => rule.name === "Protect main");
  if (matches.length !== 1) throw new Error("Ambiguous protection ruleset");
  const current = api(`rulesets/${matches[0].id}`);
  const next = protectedRuleset(current);
  if (apply) api(`rulesets/${current.id}`, "PUT", next);
  for (const name of ["production", "identity-verification-worker-production"]) {
    const currentEnvironment = api(`environments/${name}`);
    const rules = currentEnvironment.protection_rules ?? [];
    // Do not silently drop unfamiliar repository controls.
    if (rules.some(rule => !["wait_timer", "required_reviewers", "branch_policy"].includes(rule.type))) throw new Error("Unknown environment protection rule");
    const payload = {
      wait_timer: rules.find(rule => rule.type === "wait_timer")?.wait_timer ?? 0,
      reviewers: (rules.find(rule => rule.type === "required_reviewers")?.reviewers ?? []).map(({ type, reviewer }) => ({ type, id: reviewer.id })),
      prevent_self_review: rules.find(rule => rule.type === "required_reviewers")?.prevent_self_review ?? false,
      can_admins_bypass: currentEnvironment.can_admins_bypass ?? false,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    };
    if (apply) {
      api(`environments/${name}`, "PUT", payload);
      const policies = api(`environments/${name}/deployment-branch-policies`).branch_policies;
      if (!policies.some(policy => policy.name === "main" && policy.type === "branch")) api(`environments/${name}/deployment-branch-policies`, "POST", { name: "main", type: "branch" });
      for (const policy of policies.filter(policy => policy.name !== "main" || policy.type !== "branch")) {
        // GitHub DELETE has an empty body, so call the CLI without JSON parsing.
        execFileSync("gh", ["api", `repos/${REPOSITORY}/environments/${name}/deployment-branch-policies/${policy.id}`, "--method", "DELETE"]);
      }
    }
  }
  return { repository: REPOSITORY, applied: apply, requiredApprovals: next.rules.find(rule => rule.type === "pull_request").parameters.required_approving_review_count,
    environments: "production and identity-verification-worker-production: main branch only", existingChecksPreserved: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(configureProductionControls(process.argv.includes("--apply")))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
