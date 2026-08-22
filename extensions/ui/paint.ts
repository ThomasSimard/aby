/**
 * Turning a laid-out `Block` into terminal lines.
 *
 * The split is deliberate: `src/view.ts` decides what goes where at a given
 * width and what each run *means*; this applies the current theme to it. That is
 * why a `/theme` switch recolours every aby entry without any stored state —
 * renderers are handed a fresh `Theme` on every render and the layout is redone
 * from the same data.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { Block } from "../../src/view.ts";

export function paint(block: Block, theme: Theme, width: number): string[] {
  return block.map((line) => {
    const text = line
      .map((segment) => {
        const styled = segment.bold ? theme.bold(segment.text) : segment.text;
        return segment.color ? theme.fg(segment.color, styled) : styled;
      })
      .join("");
    // The layout budgets in codepoints; truncateToWidth is the one that knows
    // about ANSI and double-width cells, so it has the final say.
    return truncateToWidth(text, width, "…");
  });
}

/**
 * A component whose content is rebuilt from a layout function at the width the
 * viewport happens to have.
 *
 * Not a `Text`: `Text` word-wraps, which would break the bar/percentage columns
 * apart. The width-keyed cache is what makes re-rendering on every frame cheap;
 * `invalidate()` drops it so a theme change re-colours.
 */
export class BlockView implements Component {
  private build: (width: number) => Block;
  private theme: Theme;
  private cache: { width: number; lines: string[] } | undefined;

  constructor(build: (width: number) => Block, theme: Theme) {
    this.build = build;
    this.theme = theme;
  }

  invalidate(): void {
    this.cache = undefined;
  }

  render(width: number): string[] {
    const cached = this.cache;
    if (cached && cached.width === width) return cached.lines;

    const lines = paint(this.build(width), this.theme, width);
    this.cache = { width, lines };
    return lines;
  }
}
