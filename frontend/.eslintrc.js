// Metro resolves platform-specific modules by extension, so `@/lib/health` is
// satisfied by lib/health.ios.ts or lib/health.android.ts with no plain
// lib/health.ts present. ESLint resolved the `@/*` alias but not those
// extensions, and reported the import as unresolved on every screen using it.
const PLATFORM_EXTENSIONS = [
  ".ios.ts", ".android.ts", ".native.ts", ".ts",
  ".ios.tsx", ".android.tsx", ".native.tsx", ".tsx",
  ".ios.js", ".android.js", ".native.js", ".js",
  ".json",
];

module.exports = {
  extends: ["expo"],
  ignorePatterns: ["/dist/*"],
  overrides: [
    {
      // In an override rather than top-level settings, because the extended
      // expo config sets its own resolver inside a TypeScript override and
      // that would otherwise take precedence over ours.
      files: ["**/*.ts", "**/*.tsx"],
      settings: {
        "import/resolver": {
          typescript: {
            project: "./tsconfig.json",
            extensions: PLATFORM_EXTENSIONS,
          },
          node: { extensions: PLATFORM_EXTENSIONS },
        },
      },
    },
    {
      files: ["jest.config.js", "jest.setup.js", "**/*.test.ts", "**/*.test.tsx"],
      env: { jest: true },
      rules: {
        // require() is required, not a style choice, in two Jest patterns:
        // an ESM import is hoisted above jest.mock so a mock factory has to
        // require its own dependencies, and jest.isolateModules needs require
        // to get a fresh module instance.
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
