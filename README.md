# TrustLink Repair

**Revoking OAuth does not repair what the identity already did — TrustLink Repair handles the aftermath.**

When a compromised identity is frozen and its OAuth tokens are revoked, the usual runbook stops there. Shares, webhooks, guests, PATs, public repos, and config drift **keep working**. This repo is a public, MIT-licensed MVP that demonstrates a more honest next step on **synthetic** Salesforce, Slack, and GitHub tenants:

1. Freeze + revoke the compromised identity  
2. Build a **causal graph** of what that identity already did  
3. Classify each effect: `reversible` | `compensable` | `irreversible` | `UNKNOWN`  
4. Propose an **ordered** inverse / compensation plan (no magic undo)  
5. **Simulate**, then execute only validated compensations  
6. Verify business invariants  
7. Re-onboard at **least privilege** and prove old access is dead  
8. Benchmark against a revoke-only runbook (time, coverage, false undo positives)

This is **not** a production IR product. There are no live customer connectors.

## Run in under 5 minutes

Requires [Node.js 20+](https://nodejs.org/).

```bash
git clone https://github.com/Ovarixia/trustlink-repair.git
cd trustlink-repair
npm install
npm test
npm run demo
```

`npm run demo` prints the incident, classifications, ordered plan, invariant checks, and a **TrustLink vs revoke-only** table. It also writes:

- `out/trustlink-report.md`
- `out/trustlink-report.json`
- `out/trustlink-report.html`

Local UI (same demo, served on localhost):

```bash
npm run ui
# open http://127.0.0.1:8787/
```

Other commands: `npx tsx src/cli.ts fixtures` and `npx tsx src/cli.ts graph`.

## What it does

| Step | TrustLink | Revoke-only |
| --- | --- | --- |
| Freeze identity + revoke OAuth | yes | yes |
| Inspect tenant mutations (20 seeded) | yes | no |
| Causal order for undo | yes | n/a |
| Execute validated compensations | yes | no |
| Abstain on `UNKNOWN` | yes (feature) | n/a |
| Least-privilege re-onboard | yes | no |
| Leftover attacker paths (PAT, guest, webhooks, collaborator) | cleared in the demo | still live |

Seeded mutations include report shares, sharing-rule drift, outbound messages, a lead export, a finalized payment, Slack guests / public file links / bots / a secret post, GitHub admin collaborators, a malicious push, webhooks, a PAT, a public repo, an Actions secret overwrite, and a dump left in git history.

## What this does NOT undo

Honesty is the product:

- **Exfiltration** (the 12,400-row Salesforce lead CSV already left the tenant)
- **Finalized payments** (the $18,400 vendor payment stays on the ledger; treasury recall is out of band)
- **Copies outside the control plane** (Slack screenshots, unknown file downloads, git clones of a briefly public repo, blobs still in history)

`UNKNOWN` is an explicit classification. The engine **abstains** instead of inventing a successful inverse. Coverage is measured only over `reversible` + `compensable` effects. False undo positives (claiming something was fully undone when it was not) stay at **zero**.

## Project layout

```
src/fixtures.ts          20 synthetic mutations + tenant state
src/engine/graph.ts      causal graph + reverse-topo plan order
src/engine/plan.ts       classification → compensation mapping
src/engine/apply.ts      simulate / execute (fail closed)
src/engine/verify.ts     business invariants + access probes
src/engine/runbooks.ts   TrustLink vs revoke-only
src/cli.ts               demo + local UI
```

## Tests and CI

```bash
npm test          # vitest
npm run typecheck
```

GitHub Actions runs typecheck, tests, and `npm run demo` on Node 20 and 22.

## License

[MIT](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

---

## Français (court)

**TrustLink Repair** : révoquer OAuth ne répare pas ce que l’identité a déjà fait.

Démo open-source (MIT) sur des tenants **synthétiques** Salesforce / Slack / GitHub. Un graphe causal classe chaque effet (`reversible` | `compensable` | `irreversible` | `UNKNOWN`), propose un plan d’inverses/compensations **sans undo magique**, simule, n’exécute que ce qui est validé, vérifie des invariants, ré-onboard en moindre privilège, et compare à un runbook « revoke-only ».

```bash
npm install && npm run demo
```

**Ce que ça ne défait pas :** l’exfiltration, un paiement finalisé, les copies hors du tenant (clones git, captures d’écran). `UNKNOWN` est une abstention volontaire, pas un échec caché. Pas de connecteurs clients réels, pas de promesse de undo à 100 %.
