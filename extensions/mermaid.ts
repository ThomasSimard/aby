/**
 * /mermaid — view the Mermaid diagrams in a file, in the transcript.
 *
 * pi renders ```mermaid fences that appear in chat messages already; this covers
 * the case it structurally cannot, a diagram that lives in a file. `read` output
 * is a tool result, so it never passes through the markdown transformer.
 *
 * The rendering goes in as a *custom entry* rather than a message: entries are
 * durable and survive a reload, but never enter the model's context. Looking at
 * a diagram is the user's business, and spending tokens on box-drawing art the
 * model cannot see any better than the source would be a poor trade.
 *
 * Only the mermaid source is stored. The drawing is redone on every render, so
 * it re-lays-out when the terminal is resized and re-colours when the theme
 * changes — art laid out for yesterday's width would otherwise wrap into noise.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  ExtensionAPI,
  Theme,
  ThemeColor,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem, Component } from "@earendil-works/pi-tui";
import { Box, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { Cls } from "grok-mermaid";
import { extractDiagrams, fitDiagram, type Diagram } from "../src/mermaid.ts";

const ENTRY_TYPE = "mermaid-view";

/** File kinds worth offering for completion — markdown, or bare mermaid. */
const VIEWABLE = /\.(md|markdown|mmd|mermaid)$/i;

type MermaidView = {
  /** Display path, relative to the cwd when it is inside it. */
  path: string;
  diagrams: Diagram[];
};

/**
 * Semantic span classes to theme colours — the same mapping pi's built-in
 * transformer uses, so a file diagram and a chat diagram look identical.
 */
const SPAN_COLOR: Record<Cls, ThemeColor | undefined> = {
  border: "borderMuted",
  text: "text",
  edge: "accent",
  edgeLabel: "muted",
  title: "accent",
  none: undefined,
};

function expandUser(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function displayPath(absolute: string, cwd: string): string {
  const rel = relative(cwd, absolute);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : absolute;
}

/**
 * Draws the diagrams at whatever width the viewport currently has.
 *
 * A component rather than a `Text`: `Text` word-wraps, which would tear the box
 * drawing apart the moment a row exceeded the width. Here an over-wide diagram
 * falls back to its framed source instead.
 */
class DiagramView implements Component {
  private diagrams: Diagram[];
  private theme: Theme;
  private expanded: boolean;
  private cache: { width: number; lines: string[] } | undefined;

  constructor(diagrams: Diagram[], theme: Theme, expanded: boolean) {
    this.diagrams = diagrams;
    this.theme = theme;
    this.expanded = expanded;
  }

  invalidate(): void {
    this.cache = undefined;
  }

  render(width: number): string[] {
    const cached = this.cache;
    if (cached && cached.width === width) return cached.lines;

    const theme = this.theme;
    const lines: string[] = [];
    // A row wider than the viewport would spill past the box and corrupt the
    // frame, so every line is clamped: art rows fit by construction, but the
    // source-box fallback and the captions do not always.
    const push = (line: string) => lines.push(truncateToWidth(line, width, "…"));

    for (const diagram of this.diagrams) {
      if (lines.length > 0) lines.push("");

      const fit = fitDiagram(diagram.source, width);
      for (const row of fit.art.styled) {
        push(
          row
            .map((span) => {
              const color = SPAN_COLOR[span.cls];
              const text = span.cls === "title" ? theme.bold(span.text) : span.text;
              return color ? theme.fg(color, text) : text;
            })
            .join(""),
        );
      }

      if (fit.kind === "source") {
        push(theme.fg("muted", `  (${fit.reason})`));
      } else if (fit.art.warnings.length > 0) {
        // Advisory: the art is still the best drawing of the source. Say what
        // was dropped so a silently missing edge is not read as a layout bug.
        const [first = "", ...rest] = fit.art.warnings;
        const more = rest.length > 0 ? ` (+${rest.length} more)` : "";
        push(theme.fg("warning", `  ⚠ ${first}${more}`));
      }

      if (this.expanded) {
        push(theme.fg("dim", `  line ${diagram.line}`));
        for (const row of diagram.source.split("\n")) {
          push(theme.fg("dim", `  ${row}`));
        }
      }
    }

    this.cache = { width, lines };
    return lines;
  }
}

/** Directory listing completion for the path argument. */
async function pathCompletions(prefix: string): Promise<AutocompleteItem[] | null> {
  const expanded = expandUser(prefix);
  const endsInDir = expanded === "" || expanded.endsWith("/");
  const dir = endsInDir ? expanded || "." : dirname(expanded);
  const base = endsInDir ? "" : basename(expanded);

  const entries = await readdir(dir || ".", { withFileTypes: true }).catch(
    () => [],
  );

  const items: AutocompleteItem[] = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(base)) continue;
    if (entry.name.startsWith(".") && !base.startsWith(".")) continue;

    const isDir = entry.isDirectory();
    if (!isDir && !VIEWABLE.test(entry.name)) continue;

    // Rebuild against the prefix the user typed so `~` stays `~`.
    const value = (endsInDir ? prefix : prefix.slice(0, prefix.length - base.length)) +
      entry.name +
      (isDir ? "/" : "");
    items.push({ value, label: entry.name + (isDir ? "/" : "") });
  }

  items.sort((a, b) => a.value.localeCompare(b.value));
  return items.length > 0 ? items : null;
}

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer<MermaidView>(ENTRY_TYPE, (entry, { expanded }, theme) => {
    const data = entry.data;
    if (!data || data.diagrams.length === 0) return undefined;

    const count = data.diagrams.length;
    let header = theme.fg("accent", theme.bold("mermaid"));
    header += ` ${theme.fg("muted", data.path)}`;
    if (count > 1) header += theme.fg("dim", ` · ${count} diagrams`);

    const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
    box.addChild(new Text(header, 0, 0));
    box.addChild(new DiagramView(data.diagrams, theme, expanded));
    return box;
  });

  pi.registerCommand("mermaid", {
    description: "View the Mermaid diagrams in a file (usage: /mermaid path.md)",
    getArgumentCompletions: pathCompletions,
    handler: async (args, ctx) => {
      const arg = args.trim();
      if (arg === "") {
        ctx.ui.notify("usage: /mermaid <path to .md or .mmd>", "warning");
        return;
      }

      const path = resolve(ctx.cwd, expandUser(arg));

      let text: string;
      try {
        if ((await stat(path)).isDirectory()) {
          ctx.ui.notify(`${arg} is a directory`, "error");
          return;
        }
        text = await readFile(path, "utf8");
      } catch (err) {
        ctx.ui.notify(
          `could not read ${arg}: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
        return;
      }

      const diagrams = extractDiagrams(text, path);
      if (diagrams.length === 0) {
        ctx.ui.notify(`no mermaid blocks in ${arg}`, "warning");
        return;
      }

      pi.appendEntry<MermaidView>(ENTRY_TYPE, {
        path: displayPath(path, ctx.cwd),
        diagrams,
      });
    },
  });
}
