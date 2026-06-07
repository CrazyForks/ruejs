# Rue Vite Express SSR Demo

Minimal Vite middleware + Express server-side rendering prototype.

```bash
pnpm run example:vite-express-ssr
```

Open the printed URL. The server starts at `http://localhost:5174` and automatically uses the next
available HTTP and HMR ports when they are already occupied.

Routes:

- `/`
- `/about`
- `/dashboard`
- `/counter`
- any other path returns the SSR 404 page with HTTP status `404`
