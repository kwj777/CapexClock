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
const VERTICALS_DIR = "src/verticals";
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

// Globals neither walled folder may touch. typecheck:engine also refuses most of
// them for the engine (no DOM, no Node types); lint covers both folders.
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
// 1. Engine (Kevin section 1): imports only itself, relatively; pure; no `any`
// leaking out of an exported function; no locale-dependent calls.
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

// ---------------------------------------------------------------------------
// 2. Verticals (Kevin section 3): an allowlist. A vertical file may import
// exactly "@/engine", "@/verticals/...", and relative paths that stay inside
// src/verticals. Nothing else: no React, Next, Supabase, Node, app code or npm
// packages. Vertical tests may also read fixture files with node:fs / node:path.
// ---------------------------------------------------------------------------
const VERTICAL_EXTRA = ["@/engine", String.raw`@/verticals(?:/${SEGMENT})+`];
const VERTICAL_MESSAGE =
  'src/verticals is pure TypeScript: import only "@/engine", "@/verticals/...", or relative paths inside src/verticals.';

const verticalImports = (depth) => [
  "error",
  { patterns: [{ regex: notAllowed(depth, VERTICAL_EXTRA), message: VERTICAL_MESSAGE }] },
];

const verticalBoundary = [
  {
    name: "verticals/boundary",
    files: [`${VERTICALS_DIR}/**/*.${EXTS}`],
    rules: {
      "no-restricted-imports": verticalImports(0), // fail closed below MAX_DEPTH

      "no-restricted-syntax": [
        "error",
        ...SNEAK_SYNTAX("src/verticals"),
        {
          selector: "ExportAllDeclaration[source.value='@/engine']",
          message: "Don't re-export the whole engine: the app must reach engine math only through vertical functions.",
        },
        {
          selector: "ExportNamedDeclaration[source.value='@/engine'][exportKind='value']",
          message: "Re-export engine *types* only (`export type { … } from \"@/engine\"`); wrap engine functions in a vertical function.",
        },
      ],
      "no-restricted-globals": ["error", ...globalsList(IMPURE_GLOBALS, "src/verticals")],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "src/verticals must be deterministic." }],
    },
  },
  ...perDepth("verticals/boundary", VERTICALS_DIR, verticalImports),
  // Tests under a vertical: the same allowlist plus node:fs and node:path (the
  // seed test reads supabase/seed.sql). Nothing else.
  ...perDepth(
    "verticals/tests",
    VERTICALS_DIR,
    (depth) => [
      "error",
      {
        patterns: [
          {
            regex: notAllowed(depth, [...VERTICAL_EXTRA, "node:fs", "node:path"]),
            message: `${VERTICAL_MESSAGE} Tests may also use node:fs and node:path.`,
          },
        ],
      },
    ],
    `${VERTICALS_DIR}/**/__tests__/**`,
  ),
];

// ---------------------------------------------------------------------------
// 3. App side (Kevin section 4): everything else reaches the engine only through
// a vertical's public entry ("@/verticals/landlord"), never the engine itself and
// never a file inside a vertical. Static imports, re-exports, import() and
// import("...") types are all covered.
// ---------------------------------------------------------------------------
const APP_ENGINE = String.raw`(^|/)engine(/|$)`;
const APP_DEEP_VERTICAL = String.raw`(^|/)verticals/[^/]+/.`;
const APP_MESSAGE = 'App code reaches the engine only through a vertical\'s public entry, e.g. "@/verticals/landlord".';
// esquery regexes cannot contain "/", hence \x2F.
const APP_WALL_SYNTAX = [
  { selector: String.raw`ImportExpression[source.value=/(^|\x2F)engine(\x2F|$)/]`, message: APP_MESSAGE },
  { selector: String.raw`ImportExpression[source.value=/(^|\x2F)verticals\x2F[^\x2F]+\x2F./]`, message: APP_MESSAGE },
  { selector: "ImportExpression[source.type!='Literal']", message: "import() takes a plain string, so the wall rules can read it." },
  { selector: String.raw`TSImportType[argument.literal.value=/(^|\x2F)engine(\x2F|$)/]`, message: APP_MESSAGE },
  { selector: String.raw`TSImportType[argument.literal.value=/(^|\x2F)verticals\x2F[^\x2F]+\x2F./]`, message: APP_MESSAGE },
];

const appBoundary = [
  {
    name: "app/only-via-verticals",
    files: [`src/**/*.${EXTS}`, `scripts/**/*.${EXTS}`],
    ignores: [`${ENGINE_DIR}/**`, `${VERTICALS_DIR}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: APP_ENGINE, message: APP_MESSAGE },
            { regex: APP_DEEP_VERTICAL, message: APP_MESSAGE },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...APP_WALL_SYNTAX],
    },
  },
];

// ---------------------------------------------------------------------------
// 4. Kevin section 4: no forecast math in React components or route handlers.
// A tripwire, not a proof. It REPLACES block 3's no-restricted-syntax for these
// files, so it repeats APP_WALL_SYNTAX.
// ---------------------------------------------------------------------------
const FORECAST_FIELDS =
  "total|horizonTotal|cost|baseCost|monthly|monthlyReserve|monthlyReservePerUnit|perUnit|neededNow|shortfallNow|carriedForward|startYear|endYear|yearsRemaining|endOfLifeYear|savingFor|due|low|high";
const NO_UI_MATH =
  "No forecast math in React components or route handlers: get this number from the vertical (src/verticals/landlord) or a .ts view helper.";

const uiNoMath = [
  {
    name: "ui/no-forecast-math",
    files: ["src/components/**/*.tsx", "src/app/**/*.tsx", "src/app/**/route.ts"],
    ignores: ["**/__tests__/**", "src/components/account/PortfolioImport.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...APP_WALL_SYNTAX,
        { selector: "CallExpression[callee.property.name='reduce']", message: NO_UI_MATH },
        { selector: `BinaryExpression[operator=/^[-+*%]$/] > MemberExpression[property.name=/^(${FORECAST_FIELDS})$/]`, message: NO_UI_MATH },
        { selector: `BinaryExpression[operator='/'] > MemberExpression[property.name=/^(${FORECAST_FIELDS})$/]`, message: NO_UI_MATH },
        { selector: `UnaryExpression[operator='-'] > MemberExpression[property.name=/^(${FORECAST_FIELDS})$/]`, message: NO_UI_MATH },
        { selector: "AssignmentExpression[operator=/^[-+*]=$/]", message: NO_UI_MATH },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name=/^(ceil|floor|round)$/]", message: NO_UI_MATH },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...engineBoundary,
  ...verticalBoundary,
  ...appBoundary,
  ...uiNoMath,
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
