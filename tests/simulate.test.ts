import { describe, expect, it } from "vitest";
import { seedWorld } from "../src/fixtures.js";
import { applyCompensation, simulateCompensation } from "../src/engine/apply.js";
import { cloneWorld } from "../src/world.js";
import type { Compensation } from "../src/types.js";

const paymentVoid: Compensation = {
  id: "cmp-void",
  effectId: "eff-m06-sf-payment-money",
  mutationId: "m06-sf-payment",
  tenant: "salesforce",
  kind: "void_finalized_payment",
  summary: "Naive void",
  mode: "inverse",
};

const recallExfil: Compensation = {
  id: "cmp-recall",
  effectId: "eff-m05-sf-lead-export-exfil",
  mutationId: "m05-sf-lead-export",
  tenant: "salesforce",
  kind: "recall_exfil",
  summary: "Naive recall",
  mode: "inverse",
};

describe("simulation fail-closed", () => {
  it("refuses to void a finalized payment", () => {
    const world = seedWorld();
    const sim = simulateCompensation(cloneWorld(world), paymentVoid);
    expect(sim.ok).toBe(false);
    const applied = applyCompensation(world, paymentVoid);
    expect(applied.ok).toBe(false);
    expect(world.salesforce.payments[0]?.status).toBe("finalized");
  });

  it("refuses to claim exfil recall", () => {
    const sim = simulateCompensation(seedWorld(), recallExfil);
    expect(sim.ok).toBe(false);
  });
});
