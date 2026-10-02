// Lets scripts run with ts-node use the app's "@/…" imports (the "paths"
// setting in tsconfig.json), so they share the app's code. Loaded by
// scripts/tsconfig.json before the script itself.

import Module from "node:module";
import { join } from "node:path";

type Resolve = (this: unknown, request: string, ...rest: unknown[]) => string;
const loader = Module as unknown as { _resolveFilename: Resolve };

const src = join(__dirname, "..", "src");
const resolve = loader._resolveFilename;
loader._resolveFilename = function (request, ...rest) {
  return resolve.call(this, request.startsWith("@/") ? join(src, request.slice(2)) : request, ...rest);
};
