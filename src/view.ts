/**
 * The shared visual vocabulary — status marks, mastery bars, and the layout of
 * the progress card and the editor widget.
 *
 * Layout lives here rather than in the extension for the same reason scheduling
 * does: it is arithmetic over widths and counters, and a test can check it. The
 * renderers in `extensions/` only turn a `Segment` into a coloured string; every
 * decision about *what goes where, at this width* is made in this file.
 *
 * Pure: no I/O, no clock reads (`now` is a parameter), and the one pi import is
 * a type, which type stripping erases.
 */

import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import {
  indexById,
  STATUS_COLOR,
  STATUS_MARK,
  statusOf,
  topoOrder,
  type NodeStatus,
  type RoadmapNode,
} from "./graph.ts";
import {
  describeAction,
  nextAction,
  type NextAction,
  type PlanInput,
} from "./plan.ts";

// The status marks and colours live in graph.ts, beside the graphviz palette —
// all three are status-to-appearance maps, and keeping them there avoids an
// import cycle with toMermaid, which needs the marks too.
export { STATUS_COLOR, STATUS_MARK } from "./graph.ts";

/** A run of text with the *semantic* colour it wants. The theme is applied later. */
export type Segment = {
  text: string;
  color?: ThemeColor;
  bold?: boolean;
};

/** A rendered block: lines of segments, already fitted to a width. */
export type Block = Segment[][];

const FILLED = "█";
const EMPTY = "░";

export function masteryBar(mastery: number, cells: number): string {
  const width = Math.max(0, Math.trunc(cells));
  const m = Math.min(1, Math.max(0, mastery));
  const filled = Math.round(m * width);
  return FILLED.repeat(filled) + EMPTY.repeat(width - filled);
}

/**
 * Codepoint-safe clip with an ellipsis. The components clamp again with
 * `truncateToWidth`, which understands ANSI; this is what keeps the *layout*
 * honest about its own budget before any colour is added.
 */
export function clip(text: string, width: number): string {
  if (width <= 0) return "";
  const chars = Array.from(text);
  if (chars.length <= width) return text;
  return `${chars.slice(0, Math.max(0, width - 1)).join("")}…`;
}

export function segmentsWidth(line: Segment[]): number {
  let n = 0;
  for (const s of line) n += Array.from(s.text).length;
  return n;
}

/**
 * Hard guarantee that a line fits, whatever the layout above it decided. The
 * components clamp again with `truncateToWidth`, but a layout that overflows and
 * gets chopped mid-column looks like a bug, so the budget is enforced here too.
 */
export function clipLine(line: Segment[], width: number): Segment[] {
  if (width <= 0) return [];
  const out: Segment[] = [];
  let used = 0;
  for (const segment of line) {
    const length = Array.from(segment.text).length;
    if (used + length <= width) {
      out.push(segment);
      used += length;
      continue;
    }
    if (width - used > 0) {
      out.push({ ...segment, text: clip(segment.text, width - used) });
    }
    break;
  }
  return out;
}

/**
 * Append a group only when all of it fits. Shedding a whole detail at a narrow
 * width reads better than truncating one mid-word.
 */
function appendIfRoom(line: Segment[], group: Segment[], width: number): void {
  if (segmentsWidth(line) + segmentsWidth(group) <= width) line.push(...group);
}

/** Human-scale due date. Days, because that is the unit SM-2 schedules in. */
export function relativeDue(dueAt: string | null, now: Date): string {
  if (!dueAt) return "unscheduled";
  const t = Date.parse(dueAt);
  if (!Number.isFinite(t)) return "unscheduled";
  const days = Math.round((t - now.getTime()) / 86_400_000);
  if (days > 1) return `in ${days}d`;
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  return `${Math.abs(days)}d overdue`;
}

export type ProgressRow = {
  id: string;
  title: string;
  summary: string;
  status: NodeStatus;
  /** 0..1 */
  mastery: number;
  dueAt: string | null;
};

export function progressRows(nodes: RoadmapNode[], now: Date): ProgressRow[] {
  const byId = indexById(nodes);
  return topoOrder(nodes).map((n) => ({
    id: n.id,
    title: n.title,
    summary: n.summary,
    status: statusOf(n, byId, now),
    mastery: n.mastery,
    dueAt: n.review.dueAt,
  }));
}

export type Summary = {
  goal: string;
  total: number;
  counts: Record<NodeStatus, number>;
  /** Fraction of the roadmap mastered; 0 when there is no roadmap yet. */
  progress: number;
  nextKind: NextAction["kind"];
  nextReason: string;
  /** Title of the node the next action is about, when it names one. */
  nextTitle: string | null;
  doThis: string;
};

export function summarize(input: PlanInput): Summary {
  const { profile, nodes, now } = input;
  const byId = indexById(nodes);
  const counts: Record<NodeStatus, number> = {
    mastered: 0,
    due: 0,
    available: 0,
    locked: 0,
  };
  for (const n of nodes) counts[statusOf(n, byId, now)] += 1;

  const action = nextAction(input);
  return {
    goal: profile?.goal ?? "",
    total: nodes.length,
    counts,
    progress: nodes.length === 0 ? 0 : counts.mastered / nodes.length,
    nextKind: action.kind,
    nextReason: action.reason,
    nextTitle:
      action.kind === "review" || action.kind === "learn"
        ? action.node.title
        : null,
    doThis: describeAction(action),
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Bar width for a viewport. Shrinks before the title does, because a title you
 * cannot read is worse than a bar you cannot read precisely.
 */
function barCells(width: number): number {
  return Math.max(4, Math.min(14, width - 26));
}

/** `mark bar pct  title` — the row shape shared by the card and the widget. */
function statusRow(
  row: ProgressRow,
  width: number,
  cells: number,
): Segment[] {
  const color = STATUS_COLOR[row.status];
  const pct = `${Math.round(row.mastery * 100)}%`.padStart(4);
  // 1 mark + 1 space + bar + 1 space + 4 pct + 2 spaces = the title's budget.
  const titleWidth = width - (cells + 9);
  return [
    { text: STATUS_MARK[row.status], color },
    { text: " " },
    { text: masteryBar(row.mastery, cells), color },
    { text: " " },
    { text: pct, color: "muted" },
    { text: "  " },
    { text: clip(row.title, titleWidth), color: "text" },
  ];
}

/** The two-line block above the editor: goal, then progress at a glance. */
export function widgetSegments(summary: Summary, width: number): Block {
  const cells = barCells(width);
  const lines: Block = [];

  lines.push([
    { text: "aby ", color: "accent", bold: true },
    { text: clip(summary.goal, Math.max(0, width - 4)), color: "muted" },
  ]);

  // Order of sacrifice as the terminal narrows: the next node goes first, then
  // the due count, then the bar. The mastered count always survives.
  const head: Segment[] = [
    { text: masteryBar(summary.progress, cells), color: "success" },
    { text: " " },
    { text: `${summary.counts.mastered}/${summary.total} mastered`, color: "muted" },
  ];
  if (segmentsWidth(head) > width) {
    head.splice(0, 2);
  }
  if (summary.counts.due > 0) {
    appendIfRoom(
      head,
      [
        { text: " · ", color: "dim" },
        { text: `${summary.counts.due} due`, color: "warning" },
      ],
      width,
    );
  }
  const next = summary.nextTitle ?? nextLabel(summary.nextKind);
  const room = width - segmentsWidth(head) - 9;
  if (next.length > 0 && room > 4) {
    appendIfRoom(
      head,
      [
        { text: " · ", color: "dim" },
        { text: "next: ", color: "dim" },
        { text: clip(next, room), color: "text" },
      ],
      width,
    );
  }
  lines.push(head);

  return lines.map((line) => clipLine(line, width));
}

/** What to call the next action when it isn't about a specific node. */
function nextLabel(kind: NextAction["kind"]): string {
  switch (kind) {
    case "set_goal":
      return "set a goal";
    case "assess":
      return "assessment";
    case "build_roadmap":
      return "build the roadmap";
    case "done":
      return "nothing due";
    default:
      return "";
  }
}

export type ProgressCardInput = {
  summary: Summary;
  rows: ProgressRow[];
  totals: { skills: number; lessons: number; quiz: number };
  dataDir: string;
  /** When the snapshot was taken. Due dates are relative to this, not to now. */
  now: Date;
};

/**
 * The whole /progress card. `expanded` adds each node's id, due date and
 * summary — the collapsed form is meant to be scannable in one glance, not
 * complete.
 */
export function progressCard(
  input: ProgressCardInput,
  width: number,
  expanded: boolean,
): Block {
  const { summary, rows, totals, dataDir, now } = input;
  const cells = barCells(width);
  const lines: Block = [];

  lines.push([
    { text: clip(summary.goal, width), color: "accent", bold: true },
  ]);

  const counts: Segment[] = [
    { text: `${summary.total} nodes`, color: "muted" },
  ];
  for (const status of ["mastered", "due", "available", "locked"] as const) {
    if (summary.counts[status] === 0) continue;
    appendIfRoom(
      counts,
      [
        { text: " · ", color: "dim" },
        {
          text: `${summary.counts[status]} ${status}`,
          color: STATUS_COLOR[status],
        },
      ],
      width,
    );
  }
  lines.push(counts);
  lines.push([
    {
      text: clip(
        [
          plural(totals.skills, "topic"),
          "assessed ·",
          plural(totals.lessons, "lesson"),
          "·",
          plural(totals.quiz, "answer"),
        ].join(" "),
        width,
      ),
      color: "dim",
    },
  ]);
  lines.push([]);

  for (const row of rows) {
    lines.push(statusRow(row, width, cells));
    if (!expanded) continue;

    const indent = "    ";
    const detail = `${row.id} · ${relativeDue(row.dueAt, now)}`;
    lines.push([
      { text: indent },
      { text: clip(detail, width - indent.length), color: "dim" },
    ]);
    if (row.summary.trim().length > 0) {
      lines.push([
        { text: indent },
        { text: clip(row.summary, width - indent.length), color: "muted" },
      ]);
    }
  }

  lines.push([]);
  lines.push([
    { text: "next: ", color: "dim" },
    { text: clip(summary.nextReason, Math.max(0, width - 6)), color: "muted" },
  ]);
  lines.push([{ text: clip(`data: ${dataDir}`, width), color: "dim" }]);

  return lines.map((line) => clipLine(line, width));
}
