import { describe, expect, it } from "vitest";
import { seedMutations } from "../src/fixtures.js";
import { CLASSIFICATIONS, isRepairable } from "../src/engine/plan.js";

describe("seeded mutations", () => {
  const mutations = seedMutations();
  const effects = mutations.flatMap((m) => m.effects);

  it("seeds 15–20 mutations across three tenants", () => {
    expect(mutations.length).toBeGreaterThanOrEqual(15);
    expect(mutations.length).toBeLessThanOrEqual(20);
    const tenants = new Set(mutations.map((m) => m.tenant));
    expect(tenants).toEqual(new Set(["salesforce", "slack", "github"]));
  });

  it("covers all four classifications, including honest UNKNOWN", () => {
    const classes = new Set(effects.map((e) => e.classification));
    for (const c of CLASSIFICATIONS) {
      expect(classes.has(c), `missing classification ${c}`).toBe(true);
    }
  });

  it("never marks exfil or finalized payment as repairable", () => {
    const exfil = effects.find((e) => e.id.includes("lead-export"));
    const payment = effects.find((e) => e.id.includes("sf-payment"));
    expect(exfil?.classification).toBe("irreversible");
    expect(payment?.classification).toBe("irreversible");
    expect(exfil && isRepairable(exfil)).toBe(false);
    expect(payment && isRepairable(payment)).toBe(false);
  });

  it("gives every mutation at least one effect with a rationale", () => {
    for (const m of mutations) {
      expect(m.effects.length).toBeGreaterThan(0);
      for (const e of m.effects) {
        expect(e.rationale.length).toBeGreaterThan(10);
      }
    }
  });
});
