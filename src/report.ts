import type { ComparisonReport, Metrics, RunResult } from "./types.js";
import { mermaidGraph } from "./engine/graph.js";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function clsColor(c: string): string {
  switch (c) {
    case "reversible":
      return C.green;
    case "compensable":
      return C.cyan;
    case "irreversible":
      return C.red;
    case "UNKNOWN":
      return C.yellow;
    default:
      return C.reset;
  }
}

export function renderTerminal(report: ComparisonReport): string {
  const t = report.trustlink;
  const r = report.revokeOnly;
  const lines: string[] = [];

  lines.push(`${C.bold}${C.magenta}TrustLink Repair${C.reset} — synthetic incident demo`);
  lines.push(`${C.dim}Revoking OAuth does not repair what the identity already did.${C.reset}`);
  lines.push("");
  lines.push(`${C.bold}Incident${C.reset}  ${report.incident}`);
  lines.push(`${C.bold}Identity${C.reset}  ${t.identity.email}  (${t.identity.role})`);
  lines.push("");
  lines.push(`${C.bold}[1] Freeze${C.reset}     ${t.freeze.detail}`);
  lines.push(`${C.bold}[2] Revoke${C.reset}     ${t.revoke.detail}`);
  lines.push(
    `${C.bold}[3] Graph${C.reset}      ${t.mutations.length} mutations, ${t.causalEdges.length} causal edges`,
  );
  lines.push(`${C.bold}[4] Classify${C.reset}   ${classifyLine(t)}`);
  lines.push(
    `${C.bold}[5] Plan${C.reset}       ${t.plan.length} inverse/compensation steps (reverse causal order)`,
  );
  lines.push(`${C.bold}[6/7] Sim+exec${C.reset} ${execLine(t)}`);
  lines.push(
    `${C.bold}[8] Verify${C.reset}     ${t.invariants.filter((i) => i.holds).length}/${t.invariants.length} business invariants hold`,
  );
  lines.push(
    `${C.bold}[9] Re-onboard${C.reset} ${t.reonboard?.detail ?? "skipped"}`,
  );
  lines.push("");
  lines.push(`${C.bold}Classified effects${C.reset}`);
  for (const e of t.effects) {
    lines.push(
      `  ${clsColor(e.classification)}${e.classification.padEnd(13)}${C.reset} ${e.id}  ${e.summary}`,
    );
  }
  lines.push("");
  lines.push(`${C.bold}Ordered plan (TrustLink)${C.reset}`);
  for (const step of t.plan) {
    const result = t.steps.find((s) => s.effectId === step.compensation.effectId);
    const mark = result?.outcome === "executed" ? `${C.green}executed${C.reset}` : result?.outcome;
    lines.push(
      `  ${String(step.order).padStart(2)}. [${step.compensation.mode}] ${step.compensation.summary}  → ${mark}`,
    );
  }
  lines.push("");
  lines.push(`${C.bold}UNKNOWN abstentions (feature, not a gap we paper over)${C.reset}`);
  for (const s of t.steps.filter((x) => x.outcome === "abstained_unknown")) {
    lines.push(`  • ${s.effectId}: ${s.detail}`);
  }
  lines.push("");
  lines.push(`${C.bold}Irreversible (left in place)${C.reset}`);
  for (const s of t.steps.filter((x) => x.outcome === "skipped_irreversible")) {
    lines.push(`  • ${s.effectId}: ${s.detail}`);
  }
  lines.push("");
  lines.push(`${C.bold}Invariants after TrustLink${C.reset}`);
  for (const inv of t.invariants) {
    const mark = inv.holds ? `${C.green}HOLD${C.reset}` : `${C.red}FAIL${C.reset}`;
    lines.push(`  [${mark}] ${inv.id} — ${inv.evidence}`);
  }
  lines.push("");
  lines.push(`${C.bold}Old access probes${C.reset}  (stillWorks should be false)`);
  for (const p of t.accessProbes) {
    const mark = p.stillWorks ? `${C.red}ALIVE${C.reset}` : `${C.green}DEAD${C.reset}`;
    lines.push(`  [${mark}] ${p.summary}`);
  }
  lines.push("");
  lines.push(renderComparisonTable(t.metrics, r.metrics));
  lines.push("");
  lines.push(`${C.bold}${C.yellow}What this does NOT undo${C.reset}`);
  for (const w of report.whatWeDoNotUndo) {
    lines.push(`  – ${w}`);
  }
  lines.push("");
  lines.push(`${C.dim}False undo positives: claiming an effect was fully undone when it was not.${C.reset}`);
  lines.push(
    `${C.dim}TrustLink refuses UNKNOWN and irreversible claims, so this counter stays at 0.${C.reset}`,
  );
  return lines.join("\n");
}

function classifyLine(t: RunResult): string {
  const n = (c: string) => t.effects.filter((e) => e.classification === c).length;
  return `${n("reversible")} reversible, ${n("compensable")} compensable, ${n("irreversible")} irreversible, ${n("UNKNOWN")} UNKNOWN`;
}

function execLine(t: RunResult): string {
  const executed = t.steps.filter((s) => s.outcome === "executed").length;
  const blocked = t.steps.filter((s) => s.outcome === "blocked_by_simulation").length;
  const abstained = t.steps.filter((s) => s.outcome === "abstained_unknown").length;
  const irr = t.steps.filter((s) => s.outcome === "skipped_irreversible").length;
  return `${executed} executed, ${blocked} blocked by simulation, ${irr} irreversible skipped, ${abstained} UNKNOWN abstained`;
}

export function renderComparisonTable(t: Metrics, r: Metrics): string {
  const row = (label: string, a: string, b: string) =>
    `  ${label.padEnd(24)}${a.padEnd(16)}${b}`;
  const lines = [
    `${C.bold}── Comparison vs revoke-only ──${C.reset}`,
    row("", "TrustLink", "Revoke-only"),
    row("Time (ms)", t.timeMs.toFixed(2), r.timeMs.toFixed(2)),
    row(
      "Repair coverage",
      `${t.repairedCount}/${t.repairableCount} (${pct(t.coverage)})`,
      `${r.repairedCount}/${r.repairableCount} (${pct(r.coverage)})`,
    ),
    row("Residual effects", String(t.residualActiveEffects), String(r.residualActiveEffects)),
    row("UNKNOWN abstentions", String(t.unknownAbstentions), "n/a"),
    row("Irreversible left", String(t.irreversibleLeft), String(r.irreversibleLeft)),
    row("False undo positives", String(t.falseUndoPositives), String(r.falseUndoPositives)),
    row(
      "Invariants held",
      `${t.invariantsHeld}/${t.invariantsTotal}`,
      `${r.invariantsHeld}/${r.invariantsTotal}`,
    ),
    row("Leftover attack paths", String(t.leftoverAttackPaths), String(r.leftoverAttackPaths)),
  ];
  return lines.join("\n");
}

export function renderMarkdown(report: ComparisonReport): string {
  const t = report.trustlink;
  const r = report.revokeOnly;
  return `# TrustLink Repair — comparison report

Generated: ${report.generatedAt}

**Incident:** ${report.incident}

Revoking OAuth does not repair what the identity already did. This report compares a freeze+revoke runbook with TrustLink's causal inverse/compensation plan on the same synthetic tenants.

## Classification

| Effect | Tenant | Class | Summary |
| --- | --- | --- | --- |
${t.effects.map((e) => `| \`${e.id}\` | ${e.tenant} | **${e.classification}** | ${e.summary} |`).join("\n")}

## Causal graph

\`\`\`mermaid
${mermaidGraph(t.mutations)}
\`\`\`

## Ordered inverse / compensation plan

| # | Mode | Action | Outcome |
| --- | --- | --- | --- |
${t.plan
  .map((p) => {
    const outcome = t.steps.find((s) => s.effectId === p.compensation.effectId)?.outcome ?? "";
    return `| ${p.order} | ${p.compensation.mode} | ${p.compensation.summary} | ${outcome} |`;
  })
  .join("\n")}

## UNKNOWN abstention

${t.steps
  .filter((s) => s.outcome === "abstained_unknown")
  .map((s) => `- \`${s.effectId}\`: ${s.detail}`)
  .join("\n")}

## Irreversible (not claimed undone)

${t.steps
  .filter((s) => s.outcome === "skipped_irreversible")
  .map((s) => `- \`${s.effectId}\`: ${s.detail}`)
  .join("\n")}

## Invariants

### TrustLink

${t.invariants.map((i) => `- ${i.holds ? "✅" : "❌"} **${i.id}** — ${i.evidence}`).join("\n")}

### Revoke-only

${r.invariants.map((i) => `- ${i.holds ? "✅" : "❌"} **${i.id}** — ${i.evidence}`).join("\n")}

## Re-onboard

${t.reonboard ? `${t.reonboard.detail} Scopes: ${t.reonboard.scopes.join(", ")}.` : "_not performed_"}

Old OAuth / PAT / collaborator / guest / webhook probes after TrustLink:

${t.accessProbes.map((p) => `- ${p.stillWorks ? "⚠️ ALIVE" : "✅ DEAD"} ${p.summary}`).join("\n")}

## Comparison

| Metric | TrustLink | Revoke-only |
| --- | --- | --- |
| Time (ms) | ${t.metrics.timeMs.toFixed(2)} | ${r.metrics.timeMs.toFixed(2)} |
| Repair coverage | ${t.metrics.repairedCount}/${t.metrics.repairableCount} (${(t.metrics.coverage * 100).toFixed(0)}%) | ${r.metrics.repairedCount}/${r.metrics.repairableCount} (${(r.metrics.coverage * 100).toFixed(0)}%) |
| Residual effects | ${t.metrics.residualActiveEffects} | ${r.metrics.residualActiveEffects} |
| UNKNOWN abstentions | ${t.metrics.unknownAbstentions} | n/a |
| Irreversible left | ${t.metrics.irreversibleLeft} | ${r.metrics.irreversibleLeft} |
| False undo positives | ${t.metrics.falseUndoPositives} | ${r.metrics.falseUndoPositives} |
| Invariants held | ${t.metrics.invariantsHeld}/${t.metrics.invariantsTotal} | ${r.metrics.invariantsHeld}/${r.metrics.invariantsTotal} |
| Leftover attack paths | ${t.metrics.leftoverAttackPaths} | ${r.metrics.leftoverAttackPaths} |

## What this does NOT undo

${report.whatWeDoNotUndo.map((w) => `- ${w}`).join("\n")}

---

_Synthetic demo. No production connectors. No claim of 100% undo._
`;
}

export function renderHtml(report: ComparisonReport): string {
  const mdish = renderMarkdown(report)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const t = report.trustlink.metrics;
  const r = report.revokeOnly.metrics;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>TrustLink Repair — demo report</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0b1020; color: #e8ecf1; }
    header { padding: 2rem 1.5rem 1rem; background: linear-gradient(120deg, #1b1340, #0b1020); }
    h1 { margin: 0 0 .4rem; font-size: 1.6rem; }
    .sub { color: #9aa7b8; }
    main { padding: 1rem 1.5rem 3rem; max-width: 1100px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #151b2e; border: 1px solid #2a3550; border-radius: 12px; padding: 1rem 1.1rem; }
    .metric { font-size: 2rem; font-weight: 700; }
    .ok { color: #5ee0a0; } .bad { color: #ff8b8b; } .unk { color: #ffd36b; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    th, td { text-align: left; padding: .45rem .4rem; border-bottom: 1px solid #2a3550; vertical-align: top; }
    code { color: #c7b6ff; }
    pre { white-space: pre-wrap; line-height: 1.45; }
    footer { color: #9aa7b8; font-size: .85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>TrustLink Repair</h1>
    <p class="sub">Revoking OAuth does not repair what the identity already did.</p>
    <p class="sub">${escapeAttr(report.incident)}</p>
  </header>
  <main>
    <div class="grid">
      ${metricCard("TrustLink coverage", `${(t.coverage * 100).toFixed(0)}%`, "ok", `${t.repairedCount}/${t.repairableCount} repairable effects`)}
      ${metricCard("Revoke-only coverage", `${(r.coverage * 100).toFixed(0)}%`, "bad", `${r.repairedCount}/${r.repairableCount} repairable effects`)}
      ${metricCard("Leftover attack paths", String(t.leftoverAttackPaths), t.leftoverAttackPaths === 0 ? "ok" : "bad", `revoke-only still has ${r.leftoverAttackPaths}`)}
      ${metricCard("False undo positives", String(t.falseUndoPositives), "ok", "UNKNOWN/irreversible are never claimed undone")}
    </div>
    <div class="card" style="margin-top:1rem">
      <h2>Comparison</h2>
      <table>
        <thead><tr><th>Metric</th><th>TrustLink</th><th>Revoke-only</th></tr></thead>
        <tbody>
          <tr><td>Time (ms)</td><td>${t.timeMs.toFixed(2)}</td><td>${r.timeMs.toFixed(2)}</td></tr>
          <tr><td>Residual effects</td><td>${t.residualActiveEffects}</td><td>${r.residualActiveEffects}</td></tr>
          <tr><td>UNKNOWN abstentions</td><td class="unk">${t.unknownAbstentions}</td><td>n/a</td></tr>
          <tr><td>Invariants held</td><td>${t.invariantsHeld}/${t.invariantsTotal}</td><td>${r.invariantsHeld}/${r.invariantsTotal}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="card" style="margin-top:1rem">
      <h2>What this does NOT undo</h2>
      <ul>${report.whatWeDoNotUndo.map((w) => `<li>${escapeAttr(w)}</li>`).join("")}</ul>
    </div>
    <div class="card" style="margin-top:1rem">
      <h2>Full markdown report</h2>
      <pre>${mdish}</pre>
    </div>
    <footer>Synthetic multi-SaaS demo. MIT licensed. No production customer connectors.</footer>
  </main>
</body>
</html>`;
}

function metricCard(title: string, value: string, cls: string, hint: string): string {
  return `<div class="card"><div class="sub">${title}</div><div class="metric ${cls}">${value}</div><div class="sub">${hint}</div></div>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toJson(report: ComparisonReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
