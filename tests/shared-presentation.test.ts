import { readFileSync } from "node:fs";
import postcss, { type Node } from "postcss";
import { describe, expect, it } from "vitest";

const css = postcss.parse(readFileSync("src/app/globals.css", "utf8"));

describe("shared presentation contract", () => {
  it("uses explicit selectors instead of substring recoloring", () => {
    css.walkRules((rule) => expect(rule.selector).not.toContain("[class*="));
    css.walkDecls((decl) => {
      if (!decl.important) return;
      let supportedOverride = false;
      for (let parent: Node | undefined = decl.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule" && "name" in parent && parent.name === "media" && "params" in parent && /print|prefers-reduced-motion/.test(String(parent.params))) supportedOverride = true;
      }
      expect(supportedOverride, `${decl.parent?.type}: ${decl.prop}`).toBe(true);
    });
  });

  it("keeps presentation weights and spacing on the agreed scale", () => {
    css.walkDecls((decl) => {
      if (decl.prop === "font-weight" && decl.parent?.type !== "atrule") {
        expect(["400", "500", "600", "700"]).toContain(decl.value);
      }
      if (/^(padding|margin)(-|$)|^(gap|row-gap|column-gap)$/.test(decl.prop)) {
        for (const match of decl.value.matchAll(/(-?\d*\.?\d+)(rem|px)\b/g)) {
          const pixels = Number(match[1]) * (match[2] === "rem" ? 16 : 1);
          expect(Math.abs(pixels % 8), `${decl.prop}: ${decl.value}`).toBe(0);
        }
      }
      if (decl.prop === "box-shadow") expect(decl.value).not.toMatch(/#000|rgb\(0 0 0/);
      if (decl.prop === "font-family") expect(decl.value).not.toBe("var(--portfolio-display)");
    });
  });

  it("shares action tokens without redefining personal portfolio palettes", () => {
    const definitions = new Map<string, string>();
    css.walkDecls((decl) => { if (decl.prop.startsWith("--")) definitions.set(decl.prop, decl.value); });
    for (const alias of ["--primary", "--workspace-action", "--product-action"]) {
      expect(definitions.get(alias)).toBe("var(--ui-action)");
    }
    expect(definitions.get("--ui-action")).toBe("#234b68");
    css.walkRules((rule) => {
      if (rule.selector !== ":root" && !rule.selector.includes(".dashboard-shell")) return;
      rule.walkDecls("--portfolio-primary", () => { throw new Error("Platform tokens must not override personal palettes"); });
    });
  });
});
