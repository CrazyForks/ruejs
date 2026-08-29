# Rue SSR 二进制桌面应用 Demo

这个包演示如何把一个 Rue TXT 文本编辑器打包成 Rust 二进制，并同时支持两种输出形态：

- Server 二进制：启动一个不依赖 Node 的 Rue SSR HTTP server。
- Desktop 二进制：启动内置 Rue SSR server，并用 `tao` + `wry` 打开本地 WebView。

这个 Demo 的职责划分：

- Rue 前端负责编辑器 UI：路径输入、文本编辑区、`New`、`Open`、`Save`。
- Rust 后端负责本地能力：读取和保存 `.txt` 文件。
- `deno_core` 负责在 Rust 中执行嵌入的 Rue SSR bundle。
- Vite 负责构建 SSR bundle 和浏览器端 client bundle。

**功能**

- `New`：清空编辑器内容，并在 `~/.rue-text-editor` 下生成不重复的新文件名，例如 `untitled.md`、`untitled-1.md`。
- `Open`：根据路径输入读取本地 `.txt` 文件。
- `Save`：把当前文本保存到路径输入指定的位置。
- 如果保存路径没有扩展名，Rust 会自动补成 `.txt`。
- 默认路径是 `~/.rue-text-editor/notes.md`，Rust 会自动展开 `~` 并创建目录。
- Rust 只允许这个 Demo 读写 `.txt`、`.md`、`.markdown` 文件。

**构建流程**

1. Vite 将 `src/app.tsx` 打包为 `dist/ssr-entry.js`，供 Rust / `deno_core` 做 SSR。
2. Vite 将 `src/client.tsx` 打包为 `dist/client.js`，供浏览器或 WebView 做交互。
3. `@rue-js/vite-plugin-rue` 执行 Rue JSX 编译转换。
4. `@rue-js/runtime-vapor` 的 TypeScript 响应式内核直接进入 JavaScript bundle。
5. SWC 对最终 JS chunk 做压缩和变量名压缩。
6. 构建阶段生成 `client.js.gz` 和 `ssr-entry.js.gz`。
7. Cargo 将 SSR bundle、client bundle、gzip client asset 嵌入 Rust 二进制。

**为什么有两个 JS 文件**

- `dist/ssr-entry.js`：服务端专用。Rust 嵌入它，并用 `deno_core` 执行它来生成 HTML。
- `dist/client.js`：浏览器/WebView 专用。Rust 通过 `/client.js` 返回它，用于前端交互。

两者体积接近，是因为这个 Demo 为了保持自包含，两边都会打包 Rue 的 JavaScript runtime。具体体积以每次构建生成的 `.gz` 文件为准。

`ssr-entry.js.gz` 只是用来展示压缩体积；当前 HTTP 服务真正返回的是 `client.js.gz`。

**常用命令**

从仓库根目录运行。

构建 SSR bundle：

```sh
pnpm --filter @rue-js/ssr-binary-demo build:ssr
```

构建浏览器/WebView client bundle：

```sh
pnpm --filter @rue-js/ssr-binary-demo build:client
```

构建 server release 二进制：

```sh
pnpm --filter @rue-js/ssr-binary-demo build:binary
```

完整构建 server 二进制：

```sh
pnpm --filter @rue-js/ssr-binary-demo build
```

运行 server Demo：

```sh
pnpm --filter @rue-js/ssr-binary-demo start
```

然后打开：

```text
http://127.0.0.1:8787
```

自定义端口：

```sh
pnpm --filter @rue-js/ssr-binary-demo start -- --port 3000
```

自定义 host 和端口：

```sh
pnpm --filter @rue-js/ssr-binary-demo start -- --host 0.0.0.0 --port 3000
```

直接运行 release server 二进制：

```sh
./packages/rue-ssr-binary-demo/target/release/rue-ssr-binary-demo
```

通过环境变量指定 host 和端口：

```sh
PORT=3000 HOST=127.0.0.1 ./packages/rue-ssr-binary-demo/target/release/rue-ssr-binary-demo
```

只执行一次 SSR 渲染，不启动 HTTP server：

```sh
pnpm --filter @rue-js/ssr-binary-demo render
```

**桌面应用命令**

构建桌面 WebView 二进制：

```sh
pnpm --filter @rue-js/ssr-binary-demo build:desktop
```

运行桌面 WebView 二进制：

```sh
./packages/rue-ssr-binary-demo/target/release/rue-ssr-binary-demo-desktop
```

开发时直接打开桌面 Demo：

```sh
pnpm --filter @rue-js/ssr-binary-demo desktop -- --width=1100 --height=720 --devtools
```

桌面二进制会绑定 `127.0.0.1` 的随机本地端口，然后用 WebView 打开这个本地地址。运行时不需要 Node；Node、pnpm、Vite 只在构建阶段需要。

**Rust 文件 API**

打开文本文件：

```sh
curl -s -X POST http://127.0.0.1:8787/api/open \
  -H 'Content-Type: application/json' \
  --data '{"path":"~/.rue-text-editor/notes.md"}'
```

保存文本文件：

```sh
curl -s -X POST http://127.0.0.1:8787/api/save \
  -H 'Content-Type: application/json' \
  --data '{"path":"~/.rue-text-editor/notes.md","mode":"markdown","content":"Hello Rue Desktop"}'
```

检查 gzip 返回：

```sh
curl -I -H 'Accept-Encoding: gzip' http://127.0.0.1:8787/client.js
```

正常会看到：

```text
Content-Encoding: gzip
Vary: Accept-Encoding
```

**当前限制**

- 这是 remounting demo，还不是完整 SSR hydration。
- 文件选择暂时通过路径输入完成，还没有系统文件选择对话框。
- 二进制打包用于部署便利，不等于源码保护；嵌入的 JavaScript 仍然可以被逆向提取。
- 还没有打成 macOS `.app`、dmg 或 Windows installer；当前输出是可执行文件。
