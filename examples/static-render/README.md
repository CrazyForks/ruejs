# Rue Static Render Demo

This example builds a client bundle, loads the Rue server render entry, then uses
`@rue-js/server-renderer/static` to write prerendered HTML into
`examples/static-render/dist/client`.

```bash
pnpm run example:static-render:build
pnpm run example:static-render:preview
```

This is a plain Rue + Router static-rendering demo, not a `text` / App Router
static export. `build.mjs` keeps the example-specific Vite setup and routes from
`src/main.tsx`, while the shared static renderer handles route-shaped output:

```text
dist/client/index.html
dist/client/about/index.html
dist/client/counter/index.html
```

`preview.mjs` serves `dist/client` through the shared static preview server; it
does not load a runtime SSR server.

The preview command starts at `http://localhost:4173` and automatically uses the next available
port when it is already occupied.

The prerendered routes are defined in `src/main.tsx`.

Routes:

- `/`
- `/about`
- `/counter`

Each route component is lazy-loaded with `useAsyncRouteComponent`.
