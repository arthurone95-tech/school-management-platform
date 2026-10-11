/**
 * Prettier configuration.
 *
 * Formatting is not a security control; it exists to keep diffs reviewable.
 * Run `npm run format` to apply and `npm run format:check` to verify in CI.
 *
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
};

export default config;
