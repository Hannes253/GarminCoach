/**
 * Enforces the architectural rule from the project plan: the training-engine
 * must stay a pure, framework-agnostic TypeScript package. It may never
 * import Next.js, React, or any Supabase client library.
 */
module.exports = {
  forbidden: [
    {
      name: "no-framework-or-backend-deps",
      comment:
        "training-engine must have zero dependency on next, react, or @supabase/* " +
        "so it stays pure data-in/data-out and independently testable/reusable.",
      severity: "error",
      from: { path: "^src" },
      to: { path: "^(next|react|react-dom|@supabase)($|/)" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
