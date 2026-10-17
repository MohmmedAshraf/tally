# Playground

## Deploy to Vercel

The Vite build is served as a static site and `api/index.ts` runs the same Hono app as `pnpm dev` in a single Vercel Function. Project settings live in `vercel.json`, with the Vercel project root set to `examples/playground`.

Deploys are manual from the repository root:

```sh
vercel link --project tally-playground
vercel
vercel --prod
```

Set `ANTHROPIC_API_KEY` in the Vercel project to enable the AI features.

To self-host instead, build with `pnpm turbo run build --filter playground...` and run `pnpm --filter playground start`.

## Caveats

- Edits made through the remote transport live in the memory of one function instance and reset when it is recycled.
- The live stream reconnects whenever the function reaches its 300 second duration limit.
