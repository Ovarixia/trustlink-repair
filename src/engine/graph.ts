import type { Effect, Mutation } from "../types.js";

export interface CausalGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

/** A → B means A enabled / caused B. */
export function buildCausalGraph(mutations: Mutation[]): CausalGraph {
  const nodes = mutations.map((m) => m.id);
  const edges: Array<{ from: string; to: string }> = [];
  const known = new Set(nodes);
  for (const m of mutations) {
    for (const parent of m.causedBy) {
      if (!known.has(parent)) {
        throw new Error(`Causal parent ${parent} is missing for ${m.id}`);
      }
      edges.push({ from: parent, to: m.id });
    }
  }
  return { nodes, edges };
}

export function flattenEffects(mutations: Mutation[]): Effect[] {
  return mutations.flatMap((m) => m.effects);
}

/**
 * Reverse-topological order of mutations (undo children before parents).
 * Independent nodes break ties by timestamp descending (newest first).
 */
export function reverseCausalOrder(mutations: Mutation[]): Mutation[] {
  const byId = new Map(mutations.map((m) => [m.id, m]));
  const dependents = new Map<string, string[]>();
  for (const m of mutations) {
    dependents.set(m.id, []);
  }
  for (const m of mutations) {
    for (const parent of m.causedBy) {
      dependents.get(parent)?.push(m.id);
    }
  }

  // Kahn, but we want children-first: start with nodes that have no *dependents*
  // Actually for reverse topo: process nodes whose remaining children are 0.
  const remainingChildren = new Map<string, number>();
  for (const m of mutations) {
    remainingChildren.set(m.id, dependents.get(m.id)?.length ?? 0);
  }

  const ready = mutations
    .filter((m) => (remainingChildren.get(m.id) ?? 0) === 0)
    .sort((a, b) => b.at.localeCompare(a.at));

  const ordered: Mutation[] = [];
  const queued = new Set(ready.map((m) => m.id));

  while (ready.length) {
    const node = ready.shift();
    if (!node) break;
    ordered.push(node);
    for (const parentId of node.causedBy) {
      const left = (remainingChildren.get(parentId) ?? 1) - 1;
      remainingChildren.set(parentId, left);
      if (left === 0 && !queued.has(parentId)) {
        queued.add(parentId);
        const parent = byId.get(parentId);
        if (parent) ready.push(parent);
        ready.sort((a, b) => b.at.localeCompare(a.at));
      }
    }
  }

  if (ordered.length !== mutations.length) {
    throw new Error("Causal graph has a cycle; refusing to plan an inverse.");
  }
  return ordered;
}

export function mermaidGraph(mutations: Mutation[]): string {
  const graph = buildCausalGraph(mutations);
  const lines = ["flowchart TD"];
  for (const m of mutations) {
    const label = `${m.id}\\n${m.kind}`;
    lines.push(`  ${safe(m.id)}["${label}"]`);
  }
  for (const e of graph.edges) {
    lines.push(`  ${safe(e.from)} --> ${safe(e.to)}`);
  }
  return lines.join("\n");
}

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}
