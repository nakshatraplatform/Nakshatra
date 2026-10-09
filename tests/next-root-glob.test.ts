import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Linter } from "eslint";

const require = createRequire(import.meta.url);
const { globSync } = require("../tools/next-root-glob/index.mjs");
const plugin = require("@next/eslint-plugin-next");
const root = mkdtempSync(path.join(tmpdir(), "nak-next-roots-"));
const posix = (value: string) => value.replace(/\\/g, "/");
for (const name of ["app1", "app2", "app10", ".hidden"]) {
  mkdirSync(path.join(root, name, "pages"), { recursive: true });
  writeFileSync(path.join(root, name, "pages", "profile.tsx"), "export default function Page() { return null; }");
}
writeFileSync(path.join(root, "file.txt"), "not a directory");
symlinkSync(path.join(root, "app1"), path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
afterAll(() => rmSync(root, { recursive: true, force: true }));
const find = (pattern: string) => globSync(posix(path.join(root, pattern)), { onlyDirectories: true }).sort();

describe("pinned Next root glob adapter", () => {
  it("matches literal roots without recursively expanding their children", () => {
    expect(find("app1")).toEqual([posix(path.join(root, "app1"))]);
    const filesystemRoot = posix(path.parse(root).root);
    expect(globSync(filesystemRoot, { onlyDirectories: true })).toEqual([filesystemRoot]);
  });
  it("retains numeric ranges and brace alternatives", () => {
    expect(find("app{1..10}")).toEqual(["app1", "app10", "app2"].map(name => posix(path.join(root, name))));
    expect(find("{app1,app2}")).toEqual(["app1", "app2"].map(name => posix(path.join(root, name))));
  });
  it("includes symlink directories but excludes files, missing roots and implicit dot directories", () => {
    expect(find("linked")).toEqual([posix(path.join(root, "linked"))]);
    expect(find("*")).toEqual(["app1", "app10", "app2", "linked"].map(name => posix(path.join(root, name))));
    expect(find("file.txt")).toEqual([]);
    expect(find("missing")).toEqual([]);
    expect(find(".hidden")).toEqual([posix(path.join(root, ".hidden"))]);
  });
  it("fails visibly on changed API contracts and excessive patterns", () => {
    expect(() => globSync("*", { onlyFiles: true })).toThrow(/Unsupported/);
    expect(() => globSync("*", { onlyDirectories: true, absolute: true })).toThrow(/Unsupported/);
    expect(() => globSync("{".repeat(65), { onlyDirectories: true })).toThrow(/limit/);
    expect(() => globSync("app{1..100000000}", { onlyDirectories: true })).toThrow(/expansion limit/);
  });
  it.each(["app1", "app{1..10}", "linked"])("the actual Next rule rejects internal anchors for root %s", (pattern) => {
    const messages = new Linter().verify('export default () => <a href="/profile">Profile</a>;', {
      languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir: posix(path.join(root, pattern)) } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    });
    expect(messages.some(message => message.ruleId === "@next/next/no-html-link-for-pages" && message.severity === 2)).toBe(true);
  });
});
