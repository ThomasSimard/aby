/**
 * The roadmap as a DAG: validation, ordering, and rendering.
 *
 * Pure functions plus one graphviz shell-out. The model proposes nodes and edges;
 * this file is what refuses to accept a roadmap that contains a cycle or points at
 * a prerequisite that doesn't exist.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MASTERY_THRESHOLD, isDue, type Review } from "./schedule.ts";

export type RoadmapNode = {
  id: string;
  title: string;
  summary: string;
  /** ids of nodes that must be mastered first */
  prereqs: string[];
  /** 0..1 */
  mastery: number;
  review: Review;
};

/**
 * - `mastered`   – at or above the mastery threshold
 * - `due`        – mastered before, but a review has come due
 * - `available`  – all prerequisites mastered, not yet learned
 * - `locked`     – at least one prerequisite still unmastered
 */
export type NodeStatus = "mastered" | "due" | "available" | "locked";

export function indexById(nodes: RoadmapNode[]): Map<string, RoadmapNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Returns a cycle as a list of ids (first id repeated at the end), or null.
 * Iterative DFS with a colour marking so a deep roadmap can't blow the stack.
 */
export function findCycle(nodes: RoadmapNode[]): string[] | null {
  const byId = indexById(nodes);
  const state = new Map<string, "visiting" | "done">();
  const parent = new Map<string, string>();

  for (const start of nodes) {
    if (state.get(start.id)) continue;

    const stack: { id: string; phase: "enter" | "exit" }[] = [
      { id: start.id, phase: "enter" },
    ];

    while (stack.length > 0) {
      const frame = stack.pop();
      if (!frame) break;

      if (frame.phase === "exit") {
        state.set(frame.id, "done");
        continue;
      }
      if (state.get(frame.id) === "done") continue;

      state.set(frame.id, "visiting");
      stack.push({ id: frame.id, phase: "exit" });

      const node = byId.get(frame.id);
      if (!node) continue;

      for (const prereq of node.prereqs) {
        if (!byId.has(prereq)) continue; // reported separately by missingPrereqs
        const st = state.get(prereq);
        if (st === "visiting") {
          // Walk parent links from the current node back up to `prereq`, then
          // reverse so the cycle reads in dependency order and closes on itself.
          const chain = [frame.id];
          let cur = frame.id;
          while (cur !== prereq) {
            const p = parent.get(cur);
            if (p === undefined) break;
            chain.push(p);
            cur = p;
          }
          chain.reverse();
          const start = chain[0];
          if (start !== undefined) chain.push(start);
          return chain;
        }
        if (st !== "done") {
          parent.set(prereq, frame.id);
          stack.push({ id: prereq, phase: "enter" });
        }
      }
    }
  }
  return null;
}

/** Prerequisite ids that don't correspond to any node. */
export function missingPrereqs(
  nodes: RoadmapNode[],
): { id: string; missing: string[] }[] {
  const byId = indexById(nodes);
  const out: { id: string; missing: string[] }[] = [];
  for (const n of nodes) {
    const missing = n.prereqs.filter((p) => !byId.has(p));
    if (missing.length > 0) out.push({ id: n.id, missing });
  }
  return out;
}

/** Throws with an actionable message if the roadmap isn't a valid DAG. */
export function assertValidDag(nodes: RoadmapNode[]): void {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    ids.add(n.id);
  }
  for (const n of nodes) {
    if (n.prereqs.includes(n.id)) {
      throw new Error(`node ${n.id} lists itself as a prerequisite`);
    }
  }

  const missing = missingPrereqs(nodes);
  if (missing.length > 0) {
    const detail = missing
      .map((m) => `${m.id} -> [${m.missing.join(", ")}]`)
      .join("; ");
    throw new Error(`prerequisites reference unknown nodes: ${detail}`);
  }

  const cycle = findCycle(nodes);
  if (cycle) {
    throw new Error(`roadmap contains a cycle: ${cycle.join(" -> ")}`);
  }
}

/** Prerequisites-first ordering. Assumes assertValidDag has passed. */
export function topoOrder(nodes: RoadmapNode[]): RoadmapNode[] {
  const byId = indexById(nodes);
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const n of nodes) {
    indegree.set(n.id, n.prereqs.filter((p) => byId.has(p)).length);
    for (const p of n.prereqs) {
      if (!byId.has(p)) continue;
      const list = dependents.get(p) ?? [];
      list.push(n.id);
      dependents.set(p, list);
    }
  }

  // Sort the frontier by title so output is stable run to run.
  const ready = nodes
    .filter((n) => (indegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort();
  const out: RoadmapNode[] = [];

  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    const node = byId.get(id);
    if (node) out.push(node);

    for (const dep of dependents.get(id) ?? []) {
      const next = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, next);
      if (next === 0) {
        ready.push(dep);
        ready.sort();
      }
    }
  }
  return out;
}

export function statusOf(
  node: RoadmapNode,
  byId: Map<string, RoadmapNode>,
  now: Date,
): NodeStatus {
  if (node.mastery >= MASTERY_THRESHOLD) {
    return isDue(node.review, now) ? "due" : "mastered";
  }
  const ready = node.prereqs.every((p) => {
    const pre = byId.get(p);
    return pre ? pre.mastery >= MASTERY_THRESHOLD : true;
  });
  return ready ? "available" : "locked";
}

const STATUS_STYLE: Record<NodeStatus, { fill: string; font: string }> = {
  mastered: { fill: "#2f6f4e", font: "#ffffff" },
  due: { fill: "#b8860b", font: "#ffffff" },
  available: { fill: "#2b6cb0", font: "#ffffff" },
  locked: { fill: "#e2e8f0", font: "#4a5568" },
};

function dotEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Wrap long titles so graphviz boxes stay readable. */
function wrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line.length === 0) line = w;
    else if (line.length + 1 + w.length <= width) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\\n");
}

export function toDot(nodes: RoadmapNode[], now: Date): string {
  const byId = indexById(nodes);
  const lines: string[] = [
    "digraph roadmap {",
    "  rankdir=LR;",
    "  bgcolor=transparent;",
    '  node [shape=box style="rounded,filled" fontname="sans-serif" fontsize=11 margin="0.18,0.10"];',
    '  edge [color="#94a3b8" arrowsize=0.7];',
  ];

  for (const n of topoOrder(nodes)) {
    const st = statusOf(n, byId, now);
    const style = STATUS_STYLE[st];
    const pct = Math.round(n.mastery * 100);
    const label = `${wrap(n.title, 24)}\\n${st} · ${pct}%`;
    lines.push(
      `  "${dotEscape(n.id)}" [label="${dotEscape(label)}" fillcolor="${style.fill}" fontcolor="${style.font}"];`,
    );
  }

  for (const n of nodes) {
    for (const p of n.prereqs) {
      if (!byId.has(p)) continue;
      lines.push(`  "${dotEscape(p)}" -> "${dotEscape(n.id)}";`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

/** Mermaid, for rendering inline in the pi transcript where an SVG isn't viewable. */
export function toMermaid(nodes: RoadmapNode[], now: Date): string {
  const byId = indexById(nodes);
  const alias = new Map<string, string>();
  nodes.forEach((n, i) => alias.set(n.id, `n${i}`));

  const lines = ["graph LR"];
  const marks: Record<NodeStatus, string> = {
    mastered: "✓",
    due: "↻",
    available: "•",
    locked: "🔒",
  };

  for (const n of topoOrder(nodes)) {
    const a = alias.get(n.id);
    if (!a) continue;
    const st = statusOf(n, byId, now);
    const label = `${marks[st]} ${n.title}`.replace(/["\]]/g, "");
    lines.push(`  ${a}["${label}"]`);
  }
  for (const n of nodes) {
    const to = alias.get(n.id);
    if (!to) continue;
    for (const p of n.prereqs) {
      const from = alias.get(p);
      if (from) lines.push(`  ${from} --> ${to}`);
    }
  }
  return lines.join("\n");
}

/**
 * Render DOT to a file with graphviz. Format is taken from the output extension.
 * Rejects with graphviz's stderr so a malformed graph is debuggable.
 */
export async function renderDot(dot: string, outPath: string): Promise<string> {
  const ext = outPath.slice(outPath.lastIndexOf(".") + 1).toLowerCase();
  const format = ext === "png" ? "png" : "svg";

  await mkdir(dirname(outPath), { recursive: true });

  return await new Promise<string>((resolve, reject) => {
    const child = spawn("dot", [`-T${format}`, "-o", outPath]);
    let stderr = "";

    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => {
      reject(
        new Error(
          `could not run 'dot' (is graphviz on PATH?): ${err.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`dot exited ${code}: ${stderr.trim()}`));
    });

    child.stdin.end(dot);
  });
}

/** Write the .dot alongside the rendered image so the graph is inspectable. */
export async function writeDotSource(
  dot: string,
  outPath: string,
): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, dot, "utf8");
}
