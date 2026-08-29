/**
 * Locating the project from wherever the client happened to launch us.
 *
 * A client spawns the server with whatever cwd it likes — often the directory
 * the user started their session in, not the repo root. Both the PRD resource
 * and `.env.local` have to be found relative to the project, not to cwd, or
 * the server works from the root and mysteriously fails one directory down.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The PRD is the root marker — it's at the top level and won't move. */
export function projectRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "7929-prd.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Couldn't locate the project root: no 7929-prd.md at or above ${resolve(from)}. ` +
          "Launch the MCP server with its working directory inside the repo."
      );
    }
    dir = parent;
  }
}
