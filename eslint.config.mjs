import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// Shared pieces. Flat config: when two blocks set the same rule for a file, the
// later block's options REPLACE the earlier ones. So every block that sets
// no-restricted-imports / no-restricted-syntax for a file carries the full list
// that file needs (the shared arrays below are spread where needed).
// ---------------------------------------------------------------------------
const ENGINE_DIR = "src/engine";
const MAX_DEPTH = 6; // deeper files fall back to the depth-0 rule (fail closed)
const EXTS = "{ts,tsx,mts,cts,js,jsx,mjs,cjs}";
const SEGMENT = String.raw`[\w-][\w.-]*`; // a file/folder name; never "." or ".."

/**
 * Regex matching every import source that is NOT allowed for a file `depth`
 * folders below a walled folder: allowed are relative paths that stay inside the
 * walled folder, plus the exact `extra` alternatives.
 */
function notAllowed(depth, extra = []) {
  const down = String.raw`\.(?:/${SEGMENT})*`;
  const up = depth > 0 ? String.raw`|\.\.(?:/\.\.){0,${depth - 1}}(?:/${SEGMENT})*` : "";
  const more = extra.map((e) => `|${e}`).join("");
  return `^(?!(?:${down}${up}${more})$)`;
}

/** One block per folder depth (0..MAX_DEPTH) for a walled folder. */
function perDepth(name, dir, rule, extraFiles) {
  return Array.from({ length: MAX_DEPTH + 1 }, (_, depth) => ({
    name: `${name}-depth-${depth}`,
    files: [extraFiles ? [extraFiles, `${dir}/${"*/".repeat(depth)}*.${EXTS}`] : `${dir}/${"*/".repeat(depth)}*.${EXTS}`],
    rules: { "no-restricted-imports": rule(depth) },
  }));
}

const PURE = "is pure TypeScript: no runtime, browser, clock, locale or random globals. Pass values in as inputs.";
const globalsList = (names, where) => names.map((name) => ({ name, message: `${where} ${PURE}` }));

// Globals a walled folder may not touch. typecheck:engine also refuses most of
// them for the engine (no DOM, no Node types); lint covers the rest.
const IMPURE_GLOBALS = [
  "require", "module", "exports", "process", "window", "document", "globalThis", "self",
  "navigator", "localStorage", "sessionStorage", "fetch", "Date", "Intl", "eval", "Function",
  "console", "performance", "crypto", "setTimeout", "setInterval",
];

// Sneaks that hide a global or an import from the rules above.
const SNEAK_SYNTAX = (where) => [
  { selector: "ImportExpression", message: `No dynamic import() in ${where}; use a static import.` },
  { selector: "TSImportType", message: `No import("...") types in ${where}; use \`import type\`.` },
  { selector: "TSModuleDeclaration", message: `No \`declare module\` / \`declare global\` / namespaces in ${where}.` },
  {
    selector: "[declare=true]",
    message: `No ambient \`declare\` in ${where}: it hides a real global (fetch, Date) from the purity rules.`,
  },
];

// ---------------------------------------------------------------------------
// 1. Engine: imports only itself, relatively; pure; no `any` leaking out of an
// exported function; no locale-dependent calls.
// ---------------------------------------------------------------------------
function engineImports(depth) {
  return [
    "error",
    {
      patterns: [
        {
          regex: notAllowed(depth),
          message:
            "src/engine must stay self-contained: import only other engine files, by a relative path (./x or ../x) that stays inside src/engine. No packages, no @/ alias.",
        },
      ],
    },
  ];
}

const engineBoundary = [
  {
    name: "engine/boundary",
    files: [`${ENGINE_DIR}/**/*.${EXTS}`],
    rules: {
      // Depth-0 allowlist for every engine file; the per-depth blocks below
      // replace it for files 0..MAX_DEPTH folders down (deeper files fail closed).
      "no-restricted-imports": engineImports(0),
      "no-restricted-syntax": [
        "error",
        ...SNEAK_SYNTAX("src/engine"),
        {
          selector: "Identifier[name='Math']:not(MemberExpression > Identifier.object)",
          message: "src/engine: use Math.x() directly; aliasing Math hides Math.random from the rules.",
        },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/triple-slash-reference": ["error", { lib: "never", path: "never", types: "never" }],
      "@typescript-eslint/explicit-module-boundary-types": ["error", { allowArgumentsExplicitlyTypedAsAny: false }],
      "no-restricted-globals": ["error", ...globalsList(IMPURE_GLOBALS, "src/engine")],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "src/engine must be deterministic." },
        ...["localeCompare", "toLocaleString", "toLocaleDateString", "toLocaleTimeString", "toLocaleUpperCase", "toLocaleLowerCase"].map(
          (property) => ({ property, message: "src/engine must not depend on the runtime's locale; order and format in the vertical or the UI." }),
        ),
      ],
    },
  },
  ...perDepth("engine/boundary", ENGINE_DIR, engineImports),
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...engineBoundary,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Netlify build output.
    ".netlify/**",
    // Coverage report written by npm run test:engine.
    "coverage/**",
  ]),
]);

export default eslintConfig;
