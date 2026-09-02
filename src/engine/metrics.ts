import type { Metrics, RunResult, StepResult } from "../types.js";
import { leftoverAttackPaths } from "./verify.js";

export function computeMetrics(run: Omit<RunResult, "metrics">, timeMs: number): Metrics {
  const repairable = run.effects.filter(
    (e) => e.classification === "reversible" || e.classification === "compensable",
  );
  const repaired = run.steps.filter((s) => s.outcome === "executed");
  const unknownAbstentions = run.steps.filter((s) => s.outcome === "abstained_unknown").length;
  const irreversibleLeft = run.effects.filter((e) => e.classification === "irreversible").length;

  const residualActiveEffects = countResidual(run);
  const falseUndoPositives = countFalseUndoPositives(run.steps);

  const invariantsHeld = run.invariants.filter((i) => i.holds).length;

  return {
    runbook: run.runbook,
    timeMs,
    mutationCount: run.mutations.length,
    effectCount: run.effects.length,
    repairableCount: repairable.length,
    repairedCount: repaired.length,
    coverage: repairable.length === 0 ? 0 : repaired.length / repairable.length,
    unknownAbstentions,
    irreversibleLeft,
    residualActiveEffects,
    falseUndoPositives,
    invariantsHeld,
    invariantsTotal: run.invariants.length,
    leftoverAttackPaths: leftoverAttackPaths(run.accessProbes),
  };
}

function countResidual(run: Omit<RunResult, "metrics">): number {
  const executed = new Set(
    run.steps.filter((s) => s.outcome === "executed").map((s) => s.effectId),
  );
  return run.effects.filter((e) => {
    if (e.classification === "irreversible" || e.classification === "UNKNOWN") return true;
    return !executed.has(e.id);
  }).length;
}

function countFalseUndoPositives(steps: StepResult[]): number {
  return steps.filter((s) => s.outcome === "executed" && s.detail.includes("FALSE_UNDO")).length;
}
