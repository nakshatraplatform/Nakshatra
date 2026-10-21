import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]);
}

describe("shared brand system", () => {
  it("defines every referenced shared presentation token", () => {
    const source = sourceFiles("src").filter(file => /\.(tsx?|css)$/.test(file)).map(file => readFileSync(file, "utf8")).join("\n");
    const definitions = new Set([...source.matchAll(/(--(?:workspace|product|ui)-[\w-]+)\s*:/g)].map(match => match[1]));
    const references = new Set([...source.matchAll(/var\((--(?:workspace|product|ui)-[\w-]+)/g)].map(match => match[1]));
    expect([...references].filter(token => !definitions.has(token))).toEqual([]);
  });

  it("keeps the two app fonts and scopes the licensed Vivara display exception", () => {
    const fonts = readFileSync("src/lib/fonts.ts", "utf8");
    expect(fonts).toContain('import { Inter, Plus_Jakarta_Sans } from "next/font/google"');
    expect(fonts).toContain('variable: "--font-portfolio-body"');
    expect(fonts).toContain('variable: "--font-portfolio-display"');
    for (const file of sourceFiles("src").filter(file => /\.(tsx|css)$/.test(file))) {
      const source = readFileSync(file, "utf8");
      if (source.includes("@font-face")) {
        expect(file).toBe(join("src", "components", "landing", "LandingExperience.module.css"));
        expect(source.match(/@font-face/g)).toHaveLength(1);
        expect(source).toContain('/fonts/AkayaKanadaka-Regular.ttf');
        expect(readFileSync("docs/assets/licenses/AkayaKanadaka-OFL.txt", "utf8")).toContain("SIL OPEN FONT LICENSE");
      }
      expect(source, file).not.toMatch(/font-serif\b|font-mono\b|font-(?:geist|harmond|mango|ranade|hkgrotesk|portfolio-section|form-body)/i);
      expect(source, file).not.toMatch(/\b(?:Manrope|Playfair_Display|Tenor_Sans|Geist_Mono)\b/);
    }
  });

  it("uses semantic component colors, tinted shadows and balanced CSS functions", () => {
    for (const file of sourceFiles("src").filter(file => file.endsWith(".css"))) {
      postcss.parse(readFileSync(file, "utf8")).walkDecls(decl => {
        if (decl.prop.startsWith("--")) {
          if (/#[0-9a-f]{3}|rgba?\(/i.test(decl.value)) expect([join("src", "app", "globals.css"), join("src", "app", "app-theme.css")], file).toContain(file);
          return;
        }
        if (!decl.prop.includes("mask")) expect(decl.value, `${file}: ${decl.prop}`).not.toMatch(/#[0-9a-f]{3}|rgba?\(/i);
        if (decl.prop.includes("shadow")) expect(decl.value, file).not.toMatch(/#000|rgb\(0 0 0/);
        if (decl.prop === "font-family") {
          if (decl.value === '"Akaya Kanadaka", serif') {
            expect(file).toBe(join("src", "components", "landing", "LandingExperience.module.css"));
            expect(decl.parent?.type === "rule" ? decl.parent.selector : "@font-face").toMatch(/vivaraWord|kannadaWord|@font-face/);
          } else if (decl.parent?.type === "atrule" && decl.parent.name === "font-face") {
            expect(decl.value).toBe('"Akaya Kanadaka"');
          } else expect(decl.value, file).toMatch(/^var\(--font-portfolio-(body|display)\), (system-ui, )?sans-serif$/);
        }
        if (decl.prop === "font-weight") expect(["400", "500", "600", "700"]).toContain(decl.value);
        if (decl.prop === "transition") expect(decl.value, file).not.toMatch(/(?:^|,)\s*(all|color|background(?:-color)?|border-color)\s/);
        if (/background|color|shadow/.test(decl.prop)) {
          expect([...decl.value].filter(c => c === "(").length, `${file}: ${decl.value}`).toBe([...decl.value].filter(c => c === ")").length);
        }
      });
    }
  });

  it("does not pair a pale action foreground with a pale structural surface", () => {
    for (const file of sourceFiles("src").filter(file => file.endsWith(".css"))) {
      postcss.parse(readFileSync(file, "utf8")).walkRules(rule => {
        const background = rule.nodes.find(node => node.type === "decl" && node.prop === "background");
        const color = rule.nodes.find(node => node.type === "decl" && node.prop === "color");
        if (background?.type !== "decl" || color?.type !== "decl" || color.value !== "var(--ui-on-action)") return;
        expect(background.value, `${file}: ${rule.selector}`).not.toMatch(/^var\(--workspace-(canvas|surface|surface-muted|ink)\)$/);
        expect(background.value, `${file}: ${rule.selector}`).not.toBe("var(--teal)");
      });
    }
  });

  it("overrides Tailwind elevation and the interaction clock in its actual v4 config", () => {
    const css = postcss.parse(readFileSync("src/app/globals.css", "utf8"));
    const tokens = new Map<string, string>();
    css.walkAtRules("theme", theme => theme.walkDecls(decl => { tokens.set(decl.prop, decl.value); }));
    for (const size of ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "inner"]) {
      expect(tokens.get(`--shadow-${size}`)).toContain("color-mix(in srgb, var(--ui-ink");
    }
    expect(tokens.get("--default-transition-duration")).toBe(".2s");
    expect(tokens.get("--default-transition-timing-function")).toBe("cubic-bezier(.16, 1, .3, 1)");
    let motionProperties: string | undefined;
    css.walkRules(rule => {
      if (rule.selector === ":where(button, a, input, select, textarea, summary)") rule.walkDecls("transition-property", decl => { motionProperties = decl.value; });
    });
    expect(motionProperties).toBe("transform, box-shadow, filter");
  });
});
