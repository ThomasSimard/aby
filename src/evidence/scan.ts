/**
 * Reading numbers back out of the source.
 *
 * Pure: text in, findings out. No filesystem, no `ts.createProgram`, no type
 * checker — `test/evidence.test.ts` reads the files and this parses them. Parse-only
 * keeps the whole gate in the low milliseconds, which matters more than it sounds:
 * a check that is slow enough to be worth skipping will eventually be skipped.
 */

import ts from "typescript";

export type FoundLiteral = {
  module: string;
  line: number;
  column: number;
  value: number;
  /** Name of the nearest enclosing variable declaration, when there is one. */
  declName: string | null;
  /** Source of the enclosing expression, truncated — for the error message. */
  enclosing: string;
};

export type FoundExport = {
  module: string;
  name: string;
  value: number | number[];
  line: number;
};

function parse(module: string, text: string): ts.SourceFile {
  return ts.createSourceFile(module, text, ts.ScriptTarget.ES2023, true);
}

function at(sf: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const p = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return { line: p.line + 1, column: p.character + 1 };
}

/**
 * Read a numeric initializer, folding unary minus so `-0.2` is one value rather
 * than a literal and an operator. Returns undefined for anything else.
 */
function numericValue(node: ts.Node): number | number[] | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (ts.isAsExpression(node)) return numericValue(node.expression);
  if (ts.isArrayLiteralExpression(node)) {
    const out: number[] = [];
    for (const el of node.elements) {
      const v = numericValue(el);
      if (typeof v !== "number") return undefined;
      out.push(v);
    }
    return out;
  }
  return undefined;
}

/** Every numeric literal in a module, with enough context to name it in an error. */
export function scanNumericLiterals(module: string, text: string): FoundLiteral[] {
  const sf = parse(module, text);
  const out: FoundLiteral[] = [];

  const walk = (node: ts.Node): void => {
    // A number inside a type is a type, not a decision: `x: 0 | 1`.
    if (ts.isLiteralTypeNode(node)) return;

    if (ts.isNumericLiteral(node)) {
      // Skip the operand of a folded unary minus; the parent reported it already.
      const parent = node.parent as ts.Node | undefined;
      const folded =
        parent !== undefined &&
        ts.isPrefixUnaryExpression(parent) &&
        parent.operator === ts.SyntaxKind.MinusToken;
      if (!folded) out.push(literalAt(sf, module, node, Number(node.text)));
    } else if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand)
    ) {
      out.push(literalAt(sf, module, node, -Number(node.operand.text)));
    }

    ts.forEachChild(node, walk);
  };

  ts.forEachChild(sf, walk);
  return out;
}

function literalAt(
  sf: ts.SourceFile,
  module: string,
  node: ts.Node,
  value: number,
): FoundLiteral {
  const { line, column } = at(sf, node);
  let declName: string | null = null;
  let enclosing: ts.Node = node;
  for (let p = node.parent as ts.Node | undefined; p; p = p.parent as ts.Node | undefined) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      declName = p.name.text;
      break;
    }
    if (ts.isExpressionStatement(p) || ts.isBlock(p) || ts.isSourceFile(p)) break;
    enclosing = p;
  }
  return {
    module,
    line,
    column,
    value,
    declName,
    enclosing: enclosing.getText(sf).replace(/\s+/g, " ").slice(0, 120),
  };
}

/** Every exported numeric (or numeric-array) const in a module. */
export function scanExportedNumbers(module: string, text: string): FoundExport[] {
  const sf = parse(module, text);
  const out: FoundExport[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported !== true) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.initializer === undefined) continue;
      const value = numericValue(decl.initializer);
      if (value === undefined) continue;
      out.push({ module, name: decl.name.text, value, line: at(sf, decl).line });
    }
  }
  return out;
}

/**
 * Imports of the evidence corpus. Used by the containment test: the corpus must
 * never be reachable from anything pi loads, or the entire bibliography becomes
 * session context.
 */
export function scanEvidenceImports(module: string, text: string): string[] {
  const sf = parse(module, text);
  const out: string[] = [];

  const check = (spec: string): void => {
    if (/(^|\/)evidence\//.test(spec) || spec.endsWith("/evidence")) out.push(spec);
  };

  const walk = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      check(node.arguments[0].text);
    }
    ts.forEachChild(node, walk);
  };

  ts.forEachChild(sf, walk);
  return out;
}
