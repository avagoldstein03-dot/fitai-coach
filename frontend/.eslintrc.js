module.exports = {
  extends: ["expo"],
  ignorePatterns: ["/dist/*"],
  overrides: [
    {
      files: ["jest.config.js", "jest.setup.js", "**/*.test.ts", "**/*.test.tsx"],
      env: { jest: true },
    },
  ],
};
