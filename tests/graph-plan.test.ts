import { describe, expect, it } from "vitest";
import { seedMutations } from "../src/fixtures.js";
import { buildCausalGraph, reverseCausalOrder } from "../src/engine/graph.js";
import { proposePlan } from "../src/engine/plan.js";

describe("causal graph", () => {
  const mutations = seedMutations();

  it("only edges between known mutations", () => {
    const g = buildCausalGraph(mutations);
    const ids = new Set(g.nodes);
    expect(g.edges.length).toBeGreaterThan(0);
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("undoes children before parents", () => {
    const order = reverseCausalOrder(mutations).map((m) => m.id);
    const push = order.indexOf("m15-gh-push");
    const collab = order.indexOf("m13-gh-collab");
    const protection = order.indexOf("m14-gh-protection");
    expect(push).toBeGreaterThanOrEqual(0);
    expect(push).toBeLessThan(collab);
    expect(push).toBeLessThan(protection);
  });

  it("rejects cycles", () => {
    const cyclic = [
      { ...mutations[0]!, id: "a", causedBy: ["b"], effects: mutations[0]!.effects },
      { ...mutations[1]!, id: "b", causedBy: ["a"], effects: mutations[1]!.effects },
    ];
    expect(() => reverseCausalOrder(cyclic)).toThrow(/cycle/i);
  });
});

describe("inverse plan", () => {
  it("only plans reversible and compensable effects", () => {
    const mutations = seedMutations();
    const plan = proposePlan(mutations);
    const planned = new Set(plan.map((p) => p.compensation.effectId));
    for (const e of mutations.flatMap((m) => m.effects)) {
      if (e.classification === "UNKNOWN" || e.classification === "irreversible") {
        expect(planned.has(e.id)).toBe(false);
      } else {
        expect(planned.has(e.id)).toBe(true);
      }
    }
  });

  it("numbers steps in reverse-causal order", () => {
    const plan = proposePlan(seedMutations());
    const orders = plan.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    const push = plan.find((p) => p.compensation.mutationId === "m15-gh-push");
    const collab = plan.find((p) => p.compensation.mutationId === "m13-gh-collab");
    expect(push && collab && push.order < collab.order).toBe(true);
  });
});
