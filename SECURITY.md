# Security Policy

## This is a synthetic demo

TrustLink Repair ships **no production connectors** and processes **no real customer data**. The Salesforce, Slack, and GitHub tenants in this repository are fixtures.

Do not paste live incident artifacts, OAuth tokens, customer exports, or production configs into issues or PRs.

## What this project will never claim to undo

- Data already exfiltrated from a tenant
- Finalized payments / settled money movement
- Copies of files, secrets, or git history that left the control plane (screenshots, clones, downloads)

If a proposed change would mark any of those as successfully reversed, it will be rejected.

## Reporting a vulnerability

If you find a security issue in the **demo code itself** (for example: a compensation that deletes audit evidence, a classifier that treats exfil as reversible, or a path that executes unvalidated undos):

1. Open a GitHub issue titled `[security] …` with a reproduction against `npm run demo` / `npm test`.
2. Do not include real secrets. Use the synthetic fixtures.

There is no paid bounty program. Fixes that preserve honest `UNKNOWN` abstention are prioritized.

## Preferred disclosure

GitHub issues are acceptable because this codebase does not handle production credentials. If you believe a report still needs a private channel, email the repository owner listed on GitHub and wait for acknowledgement before posting a public write-up.
