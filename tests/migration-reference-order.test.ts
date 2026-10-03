import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("supports every persisted reference prefix before its first migration consumer", () => {
  const directory = path.join(process.cwd(), "supabase/migrations");
  let allowed = new Set<string>();
  const violations: string[] = [];

  // Final-schema tests miss upgrades with existing rows: a later generator
  // replacement can conceal a backfill that failed earlier in the sequence.
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(directory, file), "utf8");
    const events = /create or replace function app_private\.generate_public_reference\(p_prefix text\)[\s\S]*?\$\$;|app_private\.generate_public_reference\('([^']+)'\)/gi;
    for (const event of sql.matchAll(events)) {
      if (event[1]) {
        if (!allowed.has(event[1])) violations.push(`${file}: unsupported ${event[1]}`);
      } else {
        const list = event[0].match(/array\[([^\]]+)\]::text\[\]/i);
        expect(list, `${file}: generator must expose its closed prefix allowlist`).not.toBeNull();
        allowed = new Set([...list![1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
      }
    }
  }

  expect(violations).toEqual([]);
});
