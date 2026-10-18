import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : entry.name.endsWith(".tsx") ? [join(directory, entry.name)] : []);
}

it("uses framework navigation for known same-tab application anchors", () => {
  const violations: string[] = [];
  for (const path of sourceFiles(join(process.cwd(), "src"))) {
    const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function inspect(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === "a") {
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
        const value = (name: string) => attributes.find(attribute => attribute.name.getText(file) === name)?.initializer;
        const href = value("href");
        const expression = href && ts.isJsxExpression(href) ? href.expression : href;
        // Dynamic provider/attachment URLs are inventoried separately; don't guess their origin.
        const prefix = expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
          ? expression.text : expression && ts.isTemplateExpression(expression) ? expression.head.text : "";
        const target = value("target");
        const newTab = target && ts.isStringLiteral(target) && target.text === "_blank";
        if (prefix.startsWith("/") && !prefix.startsWith("//") && !prefix.startsWith("/api/") && !newTab && !value("download")) {
          violations.push(`${relative(process.cwd(), path)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(file);
  }
  expect(violations).toEqual([]);
});
