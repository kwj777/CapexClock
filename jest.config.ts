import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Shared test data that sits beside the tests but holds none.
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/fixtures\\.ts$"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx", isolatedModules: true } }],
  },
  // Coverage is measured for the forecasting engine only, and only when Jest
  // runs with --coverage (npm run test:engine). Every engine file counts, even
  // one no test loads, so an untested new file pulls the figure down.
  collectCoverageFrom: [
    "src/engine/**/*.{ts,tsx}",
    "!src/engine/**/__tests__/**",
    "!src/engine/**/*.test.{ts,tsx}",
  ],
  coverageThreshold: {
    // Jest's Config type requires a "global" entry, and tsc / next build type-check
    // this file. Empty = no repo-wide minimum.
    global: {},
    // A folder key is checked against the folder's combined totals. The key is
    // resolved from the current directory, so run Jest from the repo root.
    "./src/engine/": { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
};

export default config;
