import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CLI demo", () => {
  it("runs end-to-end in one command and writes the comparison report", () => {
    const out = join("out", "ci-demo");
    const stdout = execFileSync("npx", ["tsx", "src/cli.ts", "demo", "-o", out], {
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(stdout).toMatch(/TrustLink Repair/);
    expect(stdout).toMatch(/Comparison vs revoke-only/);
    expect(stdout).toMatch(/What this does NOT undo/);
    expect(stdout).toMatch(/UNKNOWN abstention/);
    expect(existsSync(join(out, "trustlink-report.md"))).toBe(true);
    expect(existsSync(join(out, "trustlink-report.json"))).toBe(true);
    expect(existsSync(join(out, "trustlink-report.html"))).toBe(true);
    const json = JSON.parse(readFileSync(join(out, "trustlink-report.json"), "utf8"));
    expect(json.trustlink.metrics.coverage).toBeGreaterThan(json.revokeOnly.metrics.coverage);
    expect(json.trustlink.metrics.falseUndoPositives).toBe(0);
  });
});
