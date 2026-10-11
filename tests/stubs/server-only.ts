// Test stub for the `server-only` marker package.
//
// The real `server-only` module throws when it is bundled into client code.
// Vitest resolves the default (client) condition, so it is aliased to this
// empty module for tests only. See vitest.config.mts.
export {};
