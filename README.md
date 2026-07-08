# Rue.js

[![Website](https://img.shields.io/badge/website-ruejs.huododo.com-0f766e)](https://ruejs.huododo.com)
[![npm version](https://img.shields.io/npm/v/%40rue-js%2Frue.svg?style=flat)](https://www.npmjs.com/package/@rue-js/rue)
[![Build and Test](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Rue.js (pronounced /ruː/) is a lightweight frontend framework for JSX/TSX. It focuses on a simple and intuitive development experience while providing a default fine-grained reactive rendering path, routing, Rust/WebAssembly-based runtime extensions, and a Rust-powered reactive system with native DOM compilation capabilities.

It is designed for projects that want to keep a React-style JSX development workflow while gaining Vue-like reactive APIs and a DOM update model that stays closer to the real DOM.

## Features

- Lightweight, intuitive APIs that are easy to adopt incrementally
- A default fine-grained reactive rendering path that performs minimal updates against the real DOM
- First-class JSX/TSX support without an additional template syntax
- Vue-like reactive APIs, including `ref`, `reactive`, and `computed`
- A Rust/WebAssembly-based runtime for extensible compile-time and rendering capabilities
- A Rust-powered reactive system covering signals, dependency tracking, and scheduling
- A Rust/Wasm native DOM compiler that transforms JSX into output closer to the real DOM
- Official routing, design component library, and build plugins that work together
- Rust-side core capabilities through `@rue-js/runtime-vapor` and `@rue-js/swc-plugin-rue`

## Quick Start

Rue provides an official scaffolding tool and can also be added to an existing Vite project.

### Create a New Project

Prerequisite: Node.js >= 22.12.0

```sh
pnpm create rue@latest
npm create rue@latest
bun create rue@latest
yarn dlx create-rue@latest
```

After entering the project, install dependencies and start the development server:

```sh
cd your-project-name
pnpm install
pnpm run dev
```

### Add Rue to an Existing Project

```sh
pnpm add @rue-js/rue @rue-js/router
```

Enable Rue JSX in your Vite config:

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: { jsxImportSource: '@rue-js/rue' },
})
```

## Example

Here is a minimal Rue application:

```tsx
import { type FC, ref, useApp, useError } from '@rue-js/rue'

const Counter: FC = () => {
  const count = ref(0)

  return <button onClick={() => count.value++}>Count: {count.value}</button>
}

useError({ overlay: true, console: true })
useApp(Counter).mount('#app')
```

If you need page-level routing, add `@rue-js/router`:

```ts
import { useComponent } from '@rue-js/rue'
import { createRouter } from '@rue-js/router'

export default createRouter({
  history: 'hash',
  routes: [
    { path: '/', component: useComponent(() => import('./pages/Home')) },
    { path: '/about', component: useComponent(() => import('./pages/About')) },
  ],
})
```

## Documentation

- [Introduction](./docs/intro.md)
- [Installation](./docs/installation.md)
- [Getting Started](./docs/getting-started.md)
- [Routing](./docs/routing.md)
- [Guide](./docs/guide)
- [API](./docs/api)

This repository also includes a runnable documentation site and example pages under [app](./app) and [app/pages](./app/pages).

## Packages

This is a pnpm workspace-based monorepo. The main packages include:

- `@rue-js/rue`: framework core and JSX entry point
- `@rue-js/router`: official router
- `@rue-js/runtime-vapor`: Rust/WebAssembly runtime implementation
- `@rue-js/design`: design system and component library
- `@rue-js/vite-plugin-rue`: Vite integration
- `@rue-js/swc-plugin-rue`: SWC JSX transform plugin
- `@rue-js/jsx-runtime` / `@rue-js/jsx-dev-runtime`: JSX runtime entry points

## Local Development

This repository uses `pnpm` to manage dependencies.

```sh
make dev
pnpm install
pnpm run app-dev
pnpm run app-build
pnpm run app-preview
pnpm run dev
```

Common commands:

```sh
pnpm run build
pnpm run test
pnpm run check
pnpm run release-check
```

If you are working on `runtime-vapor`, you can also enter the package and run Rust/Wasm-related commands:

```sh
cd packages/runtime-vapor
npm test
```

## Contributing

Issues and pull requests are welcome. Before submitting changes, we recommend running at least the following checks:

```sh
pnpm run check
pnpm run test
```

If your changes involve build, release, or the Wasm runtime, please add the corresponding package-level verification.

## License

[MIT](./LICENSE)
