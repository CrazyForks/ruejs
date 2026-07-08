# text Static Export Demo

A compact Text.js app that pre-renders every route during `text build`.

```bash
pnpm --dir examples/text-static-export dev
pnpm --dir examples/text-static-export build
pnpm --dir examples/text-static-export start
```

`build` writes static HTML and RSC payload files into `dist/client/`.
`start` serves that directory directly with the local `serve-static.mjs` helper.
Do not use `text start` for this demo: it starts the production runtime server,
which can render through the App Router/RSC request pipeline instead of proving
that the exported static files are being served.

The important bit is `text.config.mjs`:

```js
export default {
  output: 'export',
}
```
