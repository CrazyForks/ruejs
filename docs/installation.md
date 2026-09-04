# 安装

使用包管理器安装 Rue、路由与 Vite 插件：

```bash
pnpm add @rue-js/rue @rue-js/router
pnpm add -D @rue-js/vite-plugin-rue
```

在 Vite 配置中启用 Rue 的 JSX：

```ts
import { defineConfig } from 'vite'
import rue from '@rue-js/vite-plugin-rue'

export default defineConfig({
  plugins: [rue()],
})
```

TypeScript 应使用 `"jsx": "preserve"`，把 JSX 转换留给 Rue 插件。
