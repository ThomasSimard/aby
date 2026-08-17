import assert from "node:assert/strict";
import { test } from "node:test";
import { extractDiagrams, fitDiagram } from "../src/mermaid.ts";

test("extracts every fenced mermaid block in source order", () => {
  const md = [
    "# Doc",
    "",
    "```mermaid",
    "graph LR",
    "  A --> B",
    "```",
    "",
    "prose",
    "",
    "```ts",
    "const notADiagram = 1;",
    "```",
    "",
    "```mermaid",
    "graph TD",
    "  C --> D",
    "```",
  ].join("\n");

  const found = extractDiagrams(md, "doc.md");
  assert.equal(found.length, 2);
  assert.equal(found[0]?.source, "graph LR\n  A --> B");
  assert.equal(found[0]?.line, 3);
  assert.equal(found[1]?.source, "graph TD\n  C --> D");
  assert.equal(found[1]?.line, 14);
});

test("handles indented fences, tildes, and info strings", () => {
  const md = [
    "- item:",
    "  ```mermaid title=x",
    "  graph LR",
    "    A --> B",
    "  ```",
    "",
    "~~~mermaid",
    "graph TD",
    "~~~",
  ].join("\n");

  const found = extractDiagrams(md, "doc.md");
  assert.equal(found.length, 2);
  // Only the fence's own indent comes off; the body keeps its shape.
  assert.equal(found[0]?.source, "graph LR\n  A --> B");
  assert.equal(found[1]?.source, "graph TD");
});

test("a longer fence is not closed by a shorter one", () => {
  const md = ["````mermaid", "graph LR", "```", "  A --> B", "````"].join("\n");
  const found = extractDiagrams(md, "doc.md");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.source, "graph LR\n```\n  A --> B");
});

test("an unterminated fence still yields its body", () => {
  const found = extractDiagrams("```mermaid\ngraph LR\n  A --> B", "doc.md");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.source, "graph LR\n  A --> B");
});

test("blank blocks and files without diagrams yield nothing", () => {
  assert.deepEqual(extractDiagrams("```mermaid\n\n```", "doc.md"), []);
  assert.deepEqual(extractDiagrams("# just prose", "doc.md"), []);
  assert.deepEqual(extractDiagrams("   \n", "diagram.mmd"), []);
});

test(".mmd and .mermaid files are one diagram, fences and all absent", () => {
  const src = "graph LR\n  A --> B\n";
  for (const path of ["diagram.mmd", "diagram.MERMAID"]) {
    const found = extractDiagrams(src, path);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.source, src);
    assert.equal(found[0]?.line, 1);
  }
});

test("fitDiagram draws the art when it fits the viewport", () => {
  const fit = fitDiagram("graph LR\n  A[Start] --> B[Done]", 120);
  assert.equal(fit.kind, "art");
  assert.ok(fit.art.width <= 120);
  assert.ok(fit.art.plain.join("\n").includes("Start"));
});

test("fitDiagram falls back to the framed source, captioned with the reason", () => {
  const narrow = fitDiagram("graph LR\n  A[Start] --> B[Done]", 12);
  assert.equal(narrow.kind, "source");
  assert.match(
    narrow.kind === "source" ? narrow.reason : "",
    /^needs \d+ columns$/,
  );

  const unsupported = fitDiagram("gantt\n  title Nope", 80);
  assert.equal(unsupported.kind, "source");
  assert.equal(
    unsupported.kind === "source" ? unsupported.reason : "",
    "unsupported diagram type",
  );
});
