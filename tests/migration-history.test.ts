import { describe, expect, it } from "vitest";
import { verifyMigrationHistory } from "../scripts/verify-migration-history.mjs";

const versions = ["20260919170000", "20261001120000"];
const rows = versions.map((version) => ({ local: version, remote: version }));

describe("production migration history verification", () => {
  it("accepts exactly the checkout's applied migrations regardless of output ordering", () => {
    expect(verifyMigrationHistory({ migrations: [...rows].reverse() }, versions)).toBe(2);
  });

  it.each([
    [rows[0], { local: versions[1], remote: "" }],
    [rows[0], { local: "", remote: versions[1] }],
    [rows[0], { local: versions[1], remote: versions[0] }],
    [rows[0], rows[0]],
    [rows[0]],
    [...rows, { local: "20261002120000", remote: "20261002120000" }],
    [null],
    [],
  ])("rejects incomplete or inconsistent history %#", (...migrations) => {
    expect(() => verifyMigrationHistory({ migrations }, versions)).toThrow();
  });

  it("rejects missing output and empty local migration inventory", () => {
    expect(() => verifyMigrationHistory({}, versions)).toThrow();
    expect(() => verifyMigrationHistory({ migrations: [] }, [])).toThrow();
  });
});
