# Rue Static Render Demo

This example builds a client bundle, builds a server render entry, then writes prerendered HTML into `examples/static-render/dist/client`.

```bash
pnpm run example:static-render:build
pnpm run example:static-render:preview
```

This is a plain Rue + Router static-rendering demo, not a `text` / App Router
static export. `build.mjs` renders the routes from `src/main.tsx` at build time
and writes route-shaped files:

```text
dist/client/index.html
dist/client/about/index.html
dist/client/counter/index.html
```

`preview.mjs` is a small static file server for `dist/client`; it does not load a
runtime SSR server.

The preview command starts at `http://localhost:4173` and automatically uses the next available
port when it is already occupied.

The prerendered routes are defined in `src/main.tsx`.

Routes:

- `/`
- `/about`
- `/counter`

Each route component is lazy-loaded with `defineAsyncRouteComponent`.
