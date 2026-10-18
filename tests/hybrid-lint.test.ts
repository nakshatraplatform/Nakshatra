import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const baseline = read("tests/fixtures/lint-rule-baseline.json");
const eslint = new ESLint({ cwd: root });
const oxlintPath = path.join(root, "node_modules/oxlint/bin/oxlint");

function runNext(code: string, filename = "fixture.tsx", config = path.join(root, ".oxlintrc.json")) {
  const directory = mkdtempSync(path.join(tmpdir(), "nak-hybrid-lint-"));
  try {
    const file = path.join(directory, filename);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, code);
    return spawnSync(process.execPath, [oxlintPath, "--config", config, "--deny-warnings", "--format=json", file], {
      cwd: root, encoding: "utf8", timeout: 15000,
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe("hybrid lint rule parity", () => {
  it.each(Object.keys(baseline))("preserves every non-Next rule and option for %s", async file => {
    const config = await eslint.calculateConfigForFile(file);
    for (const [rule, options] of Object.entries(baseline[file].rules)) {
      if (!rule.startsWith("@next/next/") || rule.endsWith("/no-location-assign-relative-destination")) {
        expect(config.rules[rule], rule).toEqual(options);
      }
    }
    expect(config.settings).toEqual(baseline[file].settings);
  });

  it("maps all 22 Next checks without silently ignoring an unsupported rule", async () => {
    const ox = read(".oxlintrc.json");
    const rules = Object.entries(baseline["src/app/page.tsx"].rules).filter(([rule]) => rule.startsWith("@next/next/"));
    expect(rules).toHaveLength(22);
    expect(Object.keys(ox.rules)).toHaveLength(21);
    expect(ox.plugins).toEqual(["nextjs"]);
    expect(ox.categories).toEqual({ correctness: "off" });
    const inventory = spawnSync(process.execPath, [oxlintPath, "--rules", "--format=json"], { cwd: root, encoding: "utf8", timeout: 15000 });
    expect(inventory.status).toBe(0);
    const supported = new Set(JSON.parse(inventory.stdout).filter((rule: { scope: string }) => rule.scope === "nextjs").map((rule: { value: string }) => `nextjs/${rule.value}`));
    const config = await eslint.calculateConfigForFile("src/app/page.tsx");
    for (const [name, value] of rules) {
      const level = (value as number[])[0];
      if (name.endsWith("/no-location-assign-relative-destination")) {
        expect(config.rules[name]).toEqual(value);
      } else {
        const mapped = name.replace("@next/next/", "nextjs/");
        expect(supported.has(mapped), mapped).toBe(true);
        expect(ox.rules[mapped], mapped).toBe(["off", "warn", "error"][level]);
      }
    }
  });

  it.each([
    ["react-hooks/rules-of-hooks", 'import {useState} from "react"; export function Broken({ready}) { if (ready) useState(0); return null; }'],
    ["react-hooks/exhaustive-deps", 'import {useEffect} from "react"; export function Broken({value}) { useEffect(()=>{console.log(value)}, []); return null; }'],
    ["react-hooks/immutability", 'export function Broken({user}) { user.name = "changed"; return <div>{user.name}</div>; }'],
    ["jsx-a11y/alt-text", 'export function Broken() { return <Image src="/test.png"/>; }'],
    ["jsx-a11y/aria-props", 'export function Broken() { return <div aria-invalid-name="x"/>; }'],
    ["@typescript-eslint/no-explicit-any", 'export const value: any = 1;'],
    ["import/no-anonymous-default-export", 'export default { value: 1 };'],
  ])("still reports %s through the actual ESLint engine", async (rule, code) => {
    const [result] = await eslint.lintText(code, { filePath: "src/hybrid-lint-fixture.tsx" });
    expect(result.messages.map(message => message.ruleId)).toContain(rule);
  });

  it.each([
    ["no-async-client-component", '"use client"; export default async function Broken() { return <div/>; }'],
    ["no-sync-scripts", 'export default function Broken() { return <script src="/test.js"/>; }'],
    ["no-html-link-for-pages", 'export default function Broken() { return <a href="/dashboard">Dashboard</a>; }'],
  ])("reports Next %s and returns a failing exit status", (rule, code) => {
    const result = runNext(code);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(rule);
  });

  it("accepts valid Next Link usage", () => {
    const result = runNext('import Link from "next/link"; export default function Good() { return <Link href="/dashboard">Dashboard</Link>; }');
    expect(result.status).toBe(0);
  });
  it("keeps native-image exceptions scoped to Oxlint without disabling other Next checks", () => {
    const code = '// oxlint-disable-next-line nextjs/no-img-element\nexport const image = <img src="/photo.jpg" alt="Photo"/>;';
    expect(runNext(code).status).toBe(0);
    const result = runNext(`${code}\nexport const script = <script src="/bad.js"/>;`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no-sync-scripts");
  });

  it("does not fall back to defaults when the configured file is missing", () => {
    const result = runNext("export const value = 1;", "fixture.tsx", path.join(root, "missing-oxlint-config.json"));
    expect(result.status).not.toBe(0);
  });
  it("fails rather than ignoring an unknown native rule", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "nak-oxlint-config-"));
    try {
      const config = path.join(directory, "invalid.json");
      writeFileSync(config, JSON.stringify({ plugins: ["nextjs"], rules: { "nextjs/not-a-real-rule": "error" } }));
      expect(runNext("export const value = 1;", "fixture.tsx", config).status).not.toBe(0);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("official Hooks errors propagate through the ESLint CLI", () => {
    const result = spawnSync(process.execPath, [path.join(root, "node_modules/eslint/bin/eslint.js"), "--stdin", "--stdin-filename", "src/hybrid-cli.tsx", "--format=json"], {
      cwd: root, encoding: "utf8", timeout: 15000,
      input: 'import {useState} from "react"; export function Broken({ready}) { if (ready) useState(0); return null; }',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("react-hooks/rules-of-hooks");
  });

  it("wires both engines into CI's npm lint and the staged-file workflow", () => {
    const pkg = read("package.json");
    expect(pkg.scripts.lint).toBe("npm run lint:next && npm run lint:eslint");
    expect(pkg.scripts["lint:next"]).toBe("oxlint --config .oxlintrc.json");
    expect(pkg.scripts["lint:eslint"]).toBe("eslint");
    expect(pkg["lint-staged"]["*.{ts,tsx,js,jsx}"]).toEqual([
      "oxlint --config .oxlintrc.json --max-warnings=0", "eslint --fix --max-warnings=0",
    ]);
    expect(pkg.devDependencies.oxlint).toBe("1.88.0");
    expect(pkg.devDependencies["eslint-config-next"]).toBeUndefined();
  });
});

describe("relative navigation compatibility rule", () => {
  const rule = "@next/next/no-location-assign-relative-destination";
  it.each([
    'location.assign("/dashboard");', 'window["location"]["assign"]("../account");',
    'globalThis.location.href = "?updated=1";', 'document.location.href = "#section";',
    'self.location.assign(`/${section}`);', 'const url = "/" + section; location.assign(url);',
    'let url = "https://example.test"; url = "/account"; location.assign(url);',
  ])("rejects an internal destination: %s", async code => {
    const [result] = await eslint.lintText(code, { filePath: "src/hybrid-navigation-fixture.ts" });
    expect(result.messages.map(message => message.ruleId)).toContain(rule);
  });
  it.each([
    'location.assign("https://verify.didit.me/session/test");',
    'window.location.href = "//example.test";', 'location.assign(destination);',
    'export function handler(location) { location.assign("/local-object"); }',
    'const window = { location: { href: "" } }; window.location.href = "/local-object";',
    'let destination; destination = destination; location.assign(destination);',
  ])("preserves external, unknown and shadowed destinations: %s", async code => {
    const [result] = await eslint.lintText(code, { filePath: "src/hybrid-navigation-fixture.ts" });
    expect(result.messages.map(message => message.ruleId)).not.toContain(rule);
  });
});
