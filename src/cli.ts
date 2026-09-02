#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";
import { Command } from "commander";
import { runComparison } from "./demo.js";
import { seedMutations, seedWorld } from "./fixtures.js";
import { mermaidGraph } from "./engine/graph.js";
import { renderHtml, renderMarkdown, renderTerminal, toJson } from "./report.js";

const program = new Command();

program
  .name("trustlink-repair")
  .description(
    "Synthetic incident demo: freeze+revoke is not repair. TrustLink builds a causal graph and an honest compensation plan.",
  )
  .version("0.1.0");

program
  .command("demo")
  .description("Run the synthetic incident + repair demo and print TrustLink vs revoke-only")
  .option("-o, --out <dir>", "directory for report files", "out")
  .option("--json", "also print JSON to stdout", false)
  .action(async (opts: { out: string; json: boolean }) => {
    const report = runComparison();
    const dir = opts.out;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "trustlink-report.md"), renderMarkdown(report));
    await writeFile(join(dir, "trustlink-report.json"), toJson(report));
    await writeFile(join(dir, "trustlink-report.html"), renderHtml(report));
    process.stdout.write(`${renderTerminal(report)}\n`);
    process.stdout.write(`\nReports written to ${dir}/trustlink-report.{md,json,html}\n`);
    if (opts.json) {
      process.stdout.write(toJson(report));
    }
  });

program
  .command("ui")
  .description("Run the demo and serve the HTML report on localhost")
  .option("-p, --port <port>", "port", "8787")
  .option("-o, --out <dir>", "directory for report files", "out")
  .action(async (opts: { port: string; out: string }) => {
    const report = runComparison();
    const dir = opts.out;
    await mkdir(dir, { recursive: true });
    const html = renderHtml(report);
    await writeFile(join(dir, "trustlink-report.html"), html);
    await writeFile(join(dir, "trustlink-report.md"), renderMarkdown(report));
    await writeFile(join(dir, "trustlink-report.json"), toJson(report));
    process.stdout.write(`${renderTerminal(report)}\n`);
    const port = Number(opts.port);
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    });
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(`\nLocal UI: http://127.0.0.1:${port}/  (Ctrl+C to stop)\n`);
    });
  });

program
  .command("fixtures")
  .description("Print seeded mutations as JSON")
  .action(() => {
    process.stdout.write(
      `${JSON.stringify({ identity: seedWorld().identity, mutations: seedMutations() }, null, 2)}\n`,
    );
  });

program
  .command("graph")
  .description("Print the causal graph as Mermaid")
  .action(() => {
    process.stdout.write(`${mermaidGraph(seedMutations())}\n`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
