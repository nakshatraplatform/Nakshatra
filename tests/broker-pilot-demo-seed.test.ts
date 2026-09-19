import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("BrokerDesk pilot demo seed", () => {
  it("is explicit, local-only, and models two isolated brokers for one customer", async () => {
    const [manifest, config, seed] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("supabase/config.toml", "utf8"),
      readFile("supabase/seeds/broker-pilot-demo.sql", "utf8"),
    ]);
    const scripts = JSON.parse(manifest).scripts as Record<string, string>;
    expect(scripts["demo:broker-pilot:reset"]).toContain("db reset --local --sql-paths");
    expect(config).toMatch(/\[db\.seed\][\s\S]*enabled = false/);
    expect(seed).toContain("rahulgr3001@gmail.com");
    expect(seed).toContain("gollapalliranganatha@gmail.com");
    expect(seed).toContain("ranganathaga64@gmail.com");
    expect(seed.match(/insert into public\.organizations/g)).toHaveLength(1);
    expect(seed).toContain("wrk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(seed).toContain("wrk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(seed).toContain("bcr_11111111111111111111111111111111");
    expect(seed).toContain("bcr_22222222222222222222222222222222");
    expect(seed).not.toContain("https://xizzzczzhqzabcipbgep.supabase.co");
  });
});
