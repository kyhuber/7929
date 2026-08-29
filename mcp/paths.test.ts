import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { projectRoot } from "./paths";

describe("projectRoot", () => {
  it("finds the repo root from a nested working directory", () => {
    // A client may spawn the server from anywhere inside the project; both the
    // PRD resource and .env.local must still resolve.
    const root = mkdtempSync(join(tmpdir(), "7929-"));
    writeFileSync(join(root, "7929-prd.md"), "# stub");
    const nested = join(root, "src", "lib");
    mkdirSync(nested, { recursive: true });

    expect(projectRoot(nested)).toBe(resolve(root));
    expect(projectRoot(root)).toBe(resolve(root));
  });

  it("explains itself when launched outside the project", () => {
    const outside = mkdtempSync(join(tmpdir(), "elsewhere-"));
    expect(() => projectRoot(outside)).toThrow(/no 7929-prd\.md at or above/);
  });
});
