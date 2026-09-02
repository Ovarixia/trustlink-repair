import { seedMutations } from "../fixtures.js";
import type { RunResult, StepResult } from "../types.js";
import { cloneWorld, type World } from "../world.js";
import { applyCompensation, simulateCompensation } from "./apply.js";
import { freezeIdentity, revokeOAuth } from "./freeze-revoke.js";
import { buildCausalGraph, flattenEffects } from "./graph.js";
import { computeMetrics } from "./metrics.js";
import { proposePlan } from "./plan.js";
import { reonboardLeastPrivilege } from "./reonboard.js";
import { probeAccess, verifyInvariants } from "./verify.js";

export function runTrustLink(world: World): RunResult {
  const started = hrtime();
  const mutations = seedMutations();
  const freeze = freezeIdentity(world);
  const revoke = revokeOAuth(world);
  const causal = buildCausalGraph(mutations);
  const effects = flattenEffects(mutations);
  const plan = proposePlan(mutations);
  const steps: StepResult[] = [];

  for (const effect of effects) {
    if (effect.classification === "UNKNOWN") {
      steps.push({
        effectId: effect.id,
        mutationId: effect.mutationId,
        classification: effect.classification,
        outcome: "abstained_unknown",
        detail: `UNKNOWN abstention: ${effect.rationale}`,
      });
    } else if (effect.classification === "irreversible") {
      steps.push({
        effectId: effect.id,
        mutationId: effect.mutationId,
        classification: effect.classification,
        outcome: "skipped_irreversible",
        detail: `Left in place: ${effect.rationale}`,
      });
    }
  }

  for (const planned of plan) {
    const effect = effects.find((e) => e.id === planned.compensation.effectId);
    if (!effect) continue;

    const sim = simulateCompensation(cloneWorld(world), planned.compensation);
    if (!sim.ok) {
      steps.push({
        effectId: effect.id,
        mutationId: effect.mutationId,
        classification: effect.classification,
        planned,
        outcome: "blocked_by_simulation",
        detail: `Simulation failed closed: ${sim.detail}`,
      });
      continue;
    }

    const applied = applyCompensation(world, planned.compensation);
    if (!applied.ok) {
      steps.push({
        effectId: effect.id,
        mutationId: effect.mutationId,
        classification: effect.classification,
        planned,
        outcome: "simulated_fail",
        detail: applied.detail,
      });
      continue;
    }

    world.executedCompensations.push(planned.compensation.id);
    if (!applied.residualRemains && effect.classification === "reversible") {
      world.claimedFullyUndone.push(effect.id);
    }

    steps.push({
      effectId: effect.id,
      mutationId: effect.mutationId,
      classification: effect.classification,
      planned,
      outcome: "executed",
      detail: applied.detail,
    });
  }

  const reonboard = reonboardLeastPrivilege(world);
  const invariants = verifyInvariants(world);
  const accessProbes = probeAccess(world);

  const partial: Omit<RunResult, "metrics"> = {
    runbook: "trustlink",
    identity: world.identity,
    freeze,
    revoke,
    mutations,
    effects,
    causalEdges: causal.edges,
    plan,
    steps,
    invariants,
    reonboard,
    accessProbes,
  };

  return { ...partial, metrics: computeMetrics(partial, elapsedMs(started)) };
}

export function runRevokeOnly(world: World): RunResult {
  const started = hrtime();
  const mutations = seedMutations();
  const freeze = freezeIdentity(world);
  const revoke = revokeOAuth(world);
  const causal = buildCausalGraph(mutations);
  const effects = flattenEffects(mutations);

  const steps: StepResult[] = effects.map((effect) => ({
    effectId: effect.id,
    mutationId: effect.mutationId,
    classification: effect.classification,
    outcome: "not_attempted",
    detail: "Revoke-only runbook does not inspect or compensate tenant mutations.",
  }));

  const invariants = verifyInvariants(world);
  const accessProbes = probeAccess(world);

  const partial: Omit<RunResult, "metrics"> = {
    runbook: "revoke-only",
    identity: world.identity,
    freeze,
    revoke,
    mutations,
    effects,
    causalEdges: causal.edges,
    plan: [],
    steps,
    invariants,
    accessProbes,
  };

  return { ...partial, metrics: computeMetrics(partial, elapsedMs(started)) };
}

function hrtime(): bigint {
  return process.hrtime.bigint();
}

function elapsedMs(started: bigint): number {
  return Number(process.hrtime.bigint() - started) / 1e6;
}
