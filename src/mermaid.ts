/**
 * Mermaid diagrams that live in files rather than in messages.
 *
 * pi already turns ```mermaid fences into Unicode art, but only inside chat
 * messages (the `markdown.mermaid` transformer). A diagram sitting in a file
 * reaches the transcript as a *tool result*, which that transformer never sees —
 * so a README's architecture graph shows up as raw source. This module is the
 * pure half of the viewer that closes that gap: which blocks a document holds,
 * and, for a given viewport width, whether the drawing fits or the framed source
 * has to stand in for it. No terminal and no pi API, so tests can reach it.
 */

import {
  diagramKind,
  render,
  sourceBox,
  type MermaidArt,
} from "grok-mermaid";

export type Diagram = {
  /** The mermaid source, fence markers stripped. */
  source: string;
  /** 1-based line of the opening fence, so the entry can point back at the file. */
  line: number;
};

/** Files that *are* a diagram, with no surrounding markdown to search. */
const WHOLE_FILE = /\.(mmd|mermaid)$/i;

/** ```mermaid / ~~~mermaid, indented up to the 3 columns CommonMark allows. */
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})[ \t]*mermaid\b/i;

/** Drop up to `indent` leading spaces — the fence's own indent, not the body's. */
function stripIndent(line: string, indent: number): string {
  let i = 0;
  while (i < indent && line[i] === " ") i++;
  return line.slice(i);
}

/**
 * Every mermaid block in `text`, in source order.
 *
 * An unterminated fence still yields its body: a half-written diagram is exactly
 * what grok-mermaid's best-effort parser is for, and refusing to show it would
 * make the viewer useless on a file being edited.
 */
export function extractDiagrams(text: string, path: string): Diagram[] {
  if (WHOLE_FILE.test(path)) {
    return text.trim().length > 0 ? [{ source: text, line: 1 }] : [];
  }

  const lines = text.split(/\r?\n/);
  const out: Diagram[] = [];

  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN.exec(lines[i] ?? "");
    if (!open) {
      i++;
      continue;
    }

    const indent = (open[1] ?? "").length;
    const fence = open[2] ?? "```";
    // A fence closes on the same character, repeated at least as many times.
    const close = new RegExp(`^ {0,3}\\${fence[0]}{${fence.length},}[ \\t]*$`);

    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (close.test(line)) break;
      body.push(stripIndent(line, indent));
    }

    const source = body.join("\n");
    if (source.trim().length > 0) out.push({ source, line: i + 1 });
    i = j + 1;
  }

  return out;
}

/**
 * What to draw for one diagram at `width` columns.
 *
 * `art` is the real drawing; `source` is the framed source standing in for it,
 * carrying the reason so the viewer can caption it rather than silently showing
 * a block of text that looks like a rendering failure.
 */
export type Fit =
  | { kind: "art"; art: MermaidArt }
  | { kind: "source"; art: MermaidArt; reason: string };

export function fitDiagram(source: string, width: number): Fit {
  const art = render(source);
  if (art && art.width <= width) return { kind: "art", art };

  // sourceBox hard-wraps to the width it is given; it can still overflow when a
  // single token is longer than the viewport, which is the caller's problem.
  const framed = sourceBox(source, width);
  if (art) {
    return {
      kind: "source",
      art: framed,
      reason: `needs ${art.width} columns`,
    };
  }

  // render() returning null is ambiguous; the header alone separates the case
  // worth reporting as a syntax error from a diagram type nobody can draw here.
  const kind = diagramKind(source);
  return {
    kind: "source",
    art: framed,
    reason: kind ? `${kind} diagram: syntax error` : "unsupported diagram type",
  };
}
