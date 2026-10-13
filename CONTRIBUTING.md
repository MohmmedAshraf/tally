# Contributing

## Setup

Node 24 or later and pnpm 12. Run `pnpm install`, then `pnpm check` to lint, typecheck, test and build every package.

## Layout

- `packages/` publishable packages. Each has one public entry point at `src/index.ts`.
- `apps/` documentation and playground.
- `examples/` runnable examples per framework and backend.

## Rules

- Every behavior change comes with a test. The query grammar is tested through the golden corpus in `packages/core/src/query/corpus`.
- Packages do not import each other's internals. Only `src/index.ts` is public.
- Dependencies are pinned in the pnpm catalog and kept at the latest release.
- Commits follow Conventional Commits with a single subject line: `type(scope): subject`.
- Changes to a published package need a changeset: `pnpm changeset`.

## Pull requests

Open a PR against `main`. CI runs lint, typecheck, tests, build, package checks and size limits. The PR title becomes the squash commit subject, so write it as a conventional commit line.
