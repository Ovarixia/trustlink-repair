# Contributing to TrustLink Repair

Thanks for helping. This repository is a **synthetic, public demo** of post-revoke identity repair. It is not a production IR product and it must stay honest about what cannot be undone.

## Ground rules

1. **No production customer connectors.** Keep Salesforce / Slack / GitHub tenants synthetic.
2. **No 100% undo claims.** Exfiltration, finalized payments, and unknown copies stay irreversible or `UNKNOWN`.
3. **UNKNOWN is a feature.** If evidence is missing, abstain. Do not invent a successful inverse.
4. **Simulation fails closed.** If a compensation cannot be validated against invariants, do not execute it.
5. **Tests first for classification changes.** Adding a mutation means adding or updating fixtures tests and, if it is irreversible, an assertion that we do not mark it repaired.

## Dev setup

Requires Node 20+.

```bash
npm install
npm test
npm run typecheck
npm run demo
```

## Pull requests

- Keep the one-command demo (`npm run demo`) working.
- Update `src/fixtures.ts` rather than scattering seed data.
- If you add a compensation kind, add an applicator in `src/engine/apply.ts` and a simulation test.
- Do not commit `out/` or `node_modules/`.

## Suggested change sizes

Small, reviewable PRs: one classification, one compensation, or one invariant — not all three unless they are inseparable.
