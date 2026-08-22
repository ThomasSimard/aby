/**
 * Drawing Mermaid in the transcript.
 *
 * Shared by `/mermaid` (diagrams that live in a file) and the roadmap entry, so
 * that a roadmap and a file diagram are drawn by the same code with the same
 * colours — the same reason `/mermaid` mirrors pi's own span-to-colour mapping.
 *
 * Only the mermaid *source* is ever stored by the callers; the drawing is redone
 * on every render, so it re-lays-out on resize and re-colours on a theme change.
 */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { Cls } from "grok-mermaid";
import { fitDiagram, type Diagram } from "../../src/mermaid.ts";

/**
 * Semantic span classes to theme colours — the same mapping pi's built-in
 * transformer uses, so a file diagram and a chat diagram look identical.
 */
export const SPAN_COLOR: Record<Cls, ThemeColor | undefined> = {
  border: "borderMuted",
  text: "text",
  edge: "accent",
  edgeLabel: "muted",
  title: "accent",
  none: undefined,
};

/**
 * One diagram, drawn at `width`, with the caption that explains a fallback.
 *
 * Every line is clamped: art rows fit by construction, but the source-box
 * fallback and the captions do not always, and a row wider than the viewport
 * would spill past its box and corrupt the frame.
 */
export function mermaidLines(
  source: string,
  theme: Theme,
  width: number,
): string[] {
  const fit = fitDiagram(source, width);
  const lines: string[] = [];
  const push = (line: string) => lines.push(truncateToWidth(line, width, "…"));

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
    // Advisory: the art is still the best drawing of the source. Say what was
    // dropped so a silently missing edge is not read as a layout bug.
    const [first = "", ...rest] = fit.art.warnings;
    const more = rest.length > 0 ? ` (+${rest.length} more)` : "";
    push(theme.fg("warning", `  ⚠ ${first}${more}`));
  }

  return lines;
}

/**
 * The first source that actually draws at `width`, or the framed fallback of the
 * first one.
 *
 * Used for the roadmap, which is emitted both left-to-right and top-down: the
 * same graph is several times wider in one direction than the other, so which
 * one is drawable is a property of the terminal, not of the roadmap.
 */
export function mermaidLinesFirstFit(
  sources: string[],
  theme: Theme,
  width: number,
): string[] {
  for (const source of sources) {
    if (fitDiagram(source, width).kind === "art") {
      return mermaidLines(source, theme, width);
    }
  }
  return mermaidLines(sources[0] ?? "", theme, width);
}

/**
 * One diagram that may be expressed several ways, drawn at the current width.
 *
 * The width-keyed cache is what keeps the per-frame cost down: without it the
 * fit search would re-render every candidate on every frame.
 */
export class MermaidFitView implements Component {
  private sources: string[];
  private theme: Theme;
  private cache: { width: number; lines: string[] } | undefined;

  constructor(sources: string[], theme: Theme) {
    this.sources = sources;
    this.theme = theme;
  }

  invalidate(): void {
    this.cache = undefined;
  }

  render(width: number): string[] {
    const cached = this.cache;
    if (cached && cached.width === width) return cached.lines;

    const lines = mermaidLinesFirstFit(this.sources, this.theme, width);
    this.cache = { width, lines };
    return lines;
  }
}

/**
 * Draws the diagrams at whatever width the viewport currently has.
 *
 * A component rather than a `Text`: `Text` word-wraps, which would tear the box
 * drawing apart the moment a row exceeded the width. Here an over-wide diagram
 * falls back to its framed source instead.
 */
export class DiagramView implements Component {
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
    const push = (line: string) => lines.push(truncateToWidth(line, width, "…"));

    for (const diagram of this.diagrams) {
      if (lines.length > 0) lines.push("");
      lines.push(...mermaidLines(diagram.source, theme, width));

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
