/**
 * Extracting the normative units out of model-facing prose.
 *
 * The tutor's pedagogy lives in `skills/tutor/SKILL.md` and in a handful of tool
 * description strings. Those are as load-bearing as anything in `src/` — "use one
 * worked example" changes what a learner sees far more than `MIN_EASE` does — so
 * they need the same provenance discipline as a numeric constant.
 *
 * The constraint is that SKILL.md must stay *clean prose*. It is a prompt: every
 * byte is model context on every tutoring turn, so citation markers, footnote
 * anchors and HTML comments are all forbidden. Provenance therefore lives entirely
 * in `bindings/prose.ts`, which quotes the file, and the duplication is deliberate
 * — the duplicate *is* the tripwire that catches a rule being reworded out from
 * under its source.
 *
 * Pure: text in, units out. No I/O; the test reads the files.
 */

/**
 * Collapse a quote to its comparable form.
 *
 * SKILL.md is hard-wrapped at ~88 columns, so a rule spans newlines and leading
 * indentation, and it carries markdown emphasis that is presentation rather than
 * content. Matching on the raw text would fail on a reflow, which is noise. Matching
 * on the normalised form still fails on a *wording* change, which is the signal.
 */
export function normalise(s: string): string {
  return s
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase alphanumeric slug of the first `words` words. */
export function slugOf(text: string, words: number): string {
  return normalise(text)
    .toLowerCase()
    .split(" ")
    .slice(0, words)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 0)
    .join("-");
}

/** How many words of a unit's text go into its id. */
export const SLUG_WORDS = 6;

export type ProseUnit = {
  /** "tutor/assessing/the-point-is-to-find-the" */
  id: string;
  file: string;
  heading: string;
  /** The unit's full text, normalised. */
  text: string;
  /** 1-indexed line where the unit starts, for error messages. */
  line: number;
};

export type ProseSource = {
  file: string;
  /** Id prefix — "tutor", "math". Explicit rather than derived from the path. */
  prefix: string;
  /** Headings whose content is normative pedagogy and must be bound. */
  normativeHeadings: readonly string[];
  /**
   * Headings deliberately left unbound, each with a reason. Declared rather than
   * omitted: a coverage guarantee you cannot enumerate the exceptions to is not a
   * guarantee.
   */
  excluded: readonly { heading: string; why: string }[];
};

/**
 * Split markdown into normative units under the declared headings.
 *
 * A unit is one top-level `- ` bullet (continuation lines joined, sub-bullets folded
 * into their parent) or one paragraph. Both, not just bullets: SKILL.md states rules
 * in plain paragraphs too ("The point is to find the edge of what they know"), and a
 * bullets-only rule would leave those silently uncovered.
 */
export function extractNormativeUnits(source: ProseSource, markdown: string): ProseUnit[] {
  const lines = markdown.split("\n");
  const units: ProseUnit[] = [];

  let heading: string | null = null;
  let buffer: string[] = [];
  let bufferLine = 0;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const text = normalise(buffer.join(" "));
    buffer = [];
    if (text.length === 0 || heading === null) return;
    if (!source.normativeHeadings.includes(heading)) return;
    units.push({
      id: `${source.prefix}/${slugOf(heading, 4)}/${slugOf(text, SLUG_WORDS)}`,
      file: source.file,
      heading,
      text,
      line: bufferLine,
    });
  };

  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";

    // YAML frontmatter is skill-selection routing, never pedagogy.
    if (i === 0 && raw.trim() === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) { if (raw.trim() === "---") inFrontmatter = false; continue; }

    const headingMatch = /^#{1,6}\s+(.*)$/.exec(raw);
    if (headingMatch) {
      flush();
      heading = (headingMatch[1] ?? "").trim();
      continue;
    }

    if (raw.trim().length === 0) { flush(); continue; }

    // A new top-level list item ends the previous unit; an indented line (a
    // continuation or a sub-bullet) belongs to the one already open.
    const isTopLevelItem = /^\s*(?:[-*+]|\d+\.)\s+/.test(raw) && !/^\s\s/.test(raw);
    if (isTopLevelItem) flush();

    if (buffer.length === 0) bufferLine = i + 1;
    buffer.push(raw.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim());
  }
  flush();

  return units;
}

/** True when `quote` appears in `haystack`, both normalised. */
export function containsQuote(haystack: string, quote: string): boolean {
  return normalise(haystack).includes(normalise(quote));
}

/**
 * Every decimal or integer appearing in a piece of prose.
 *
 * This is what catches a rule and its parameter drifting apart — SKILL.md saying a
 * score below 0.6 is a lapse while the scheduler acts on a different number.
 * Two lookbehinds rather than one. The first keeps digits inside identifiers out
 * (`MiniLM-L6`, `v2`). The second is narrower on purpose: a hyphen after a LETTER
 * is part of a name and its digits are not quantities (`SM-2`), but a hyphen
 * between two digits is a range, and both ends of a range are decisions
 * ("3-6 questions"). Missing the second half of a range would leave a parameter
 * unregistered while the check still reported success.
 *
 * Ranges written in words are invisible to it; that limit is recorded rather than
 * papered over.
 */
export function numbersIn(s: string): number[] {
  const out: number[] = [];
  for (const m of normalise(s).matchAll(/(?<![A-Za-z0-9._])(?<![A-Za-z]-)(\d+(?:\.\d+)?)(?![A-Za-z0-9.])/g)) {
    const v = Number(m[1]);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}
