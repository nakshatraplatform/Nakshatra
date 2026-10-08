import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Only checkout line endings and the final newline are presentation differences.
export function verifyDatabaseTypes(committed, generated) {
  const normalize = (source) => source.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  if (!/^export type Database = \{/m.test(generated)) {
    throw new Error("Database type generation did not produce a Database declaration");
  }
  if (normalize(committed) !== normalize(generated)) {
    throw new Error("Committed database types differ from the clean database. Review the generated database-types artifact and regenerate src/types/database.generated.ts");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("Expected the generated database types file path");
    verifyDatabaseTypes(
      readFileSync(new URL("../src/types/database.generated.ts", import.meta.url), "utf8"),
      readFileSync(process.argv[2], "utf8"),
    );
    console.log("Database types match the clean public schema.");
  } catch (error) {
    console.error(`Database type verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
