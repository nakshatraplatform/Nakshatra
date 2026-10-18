# Main and privileged deployment protection

Repository: `nakshatraplatform/Nakshatra`. Keep the active `Protect main`
ruleset; preserve existing required checks and bypass actors while tightening review.

Required settings:

- Pull requests, at least one approving review, dismiss approvals on new pushes,
  approval of the latest push by someone other than its author, resolved conversations.
- Strict up-to-date status checks: `Lint, Test, Coverage & Build`,
  `Supabase migrations and pgTAP`, and `TruffleHog Secret Scan`.
- Block force pushes and main deletion; no routine administrator bypass.
- GitHub environments `production` and `identity-verification-worker-production`
  permit the **main branch only**, including rejecting tags named main. Preserve
  existing reviewers/wait timers. Do not add a manual reviewer gate to each cron run.

With repository administration permission, preview then apply:

```sh
node scripts/production-controls.mjs
node scripts/production-controls.mjs --apply
```

The script verifies the exact Git remote and default branch, preserves the
ruleset's existing status checks and other rules, and refuses writes without
administration permission. Inspect the resulting GitHub ruleset and both
environments after applying. Repository settings are external state; merging this
file does not apply them.

October 17 remediation attempt: connected account has push/triage but **not
administration permission**. GitHub rejected the ruleset update with HTTP 404.
No environment change was attempted after that rejection. These controls remain
an open release condition, rather than a completed code fix.
