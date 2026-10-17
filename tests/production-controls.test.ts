import { expect, it } from "vitest";
import { protectedRuleset } from "../scripts/production-controls.mjs";
it("tightens review without replacing database CI or other existing controls", () => {
  const rules = [{ type: "pull_request", parameters: { required_approving_review_count: 0 } }, { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: "Supabase migrations and pgTAP", integration_id: 15368 }] } }, { type: "deletion" }];
  const original = { name: "Protect main", target: "branch", enforcement: "active", conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } }, rules };
  const result = protectedRuleset(original);
  expect(result.rules[0].parameters).toMatchObject({ required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_last_push_approval: true });
  expect(result.rules.slice(1)).toEqual(rules.slice(1));
  expect(original.rules[0].parameters?.required_approving_review_count).toBe(0);
  expect(() => protectedRuleset({ ...original, target: "tag" })).toThrow();
});
