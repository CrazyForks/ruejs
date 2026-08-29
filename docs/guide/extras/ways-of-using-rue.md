# 使用 Rue 的方式 {#ways-of-using-rue}

我们相信网络没有"一刀切"的故事。这就是为什么 Rue 被设计为灵活且可逐步采用的。根据你的用例，Rue 可以以不同的方式使用，以在技术栈复杂性、开发者体验和最终性能之间取得最佳平衡。

使用构建插件时，普通应用代码保持从 `@rue-js/rue` 导入。编译器会按能力选择三层交付：纯静态 JSX 直接生成 DOM，Signal 交互使用 compiled core，组件和复杂结构按需回退 Vapor。`@rue-js/rue/compiled` 与 `@rue-js/rue/vapor` 主要面向编译产物或底层集成，不是要求应用作者维护的两套编程模型。

## 独立脚本 {#standalone-script}

Rue 可以用作独立脚本文件——无需构建步骤！如果你已经有后端框架渲染大部分 HTML，或者你的前端逻辑不足以证明构建步骤的合理性，这是将 Rue 集成到你的技术栈中最简单的方法。你可以将 Rue 视为 jQuery 的更具声明性的替代品。

独立脚本没有编译期能力分级，因此不适用“静态零 Rue 运行时”。如果页面以静态内容为主并关心最小 JavaScript，优先使用构建步骤或客户端岛。

我们之前提供了一个名为 [petite-rue](https://github.com/@rue-js/ruejs/petite-rue) 的替代发行版，专门针对渐进式增强现有 HTML 进行了优化。然而，petite-rue 不再积极维护，最后一个版本发布于 Rue 3.2.27。

## 嵌入式 Web 组件 {#embedded-web-components}

你可以使用 Rue 来[构建标准 Web 组件](/guide/guide/extras/web-components)，这些组件可以嵌入到任何 HTML 页面中，无论它们是如何渲染的。这个选项允许你以完全与使用者无关的方式利用 Rue：生成的 web 组件可以嵌入到遗留应用程序、静态 HTML 中，甚至使用其他框架构建的应用程序中。

## 单页应用（SPA）{#single-page-application-spa}

一些应用程序需要丰富的前端交互性、深度会话和非平凡的状态逻辑。构建此类应用程序的最佳方式是使用 Rue 不仅控制整个页面，而且处理数据更新和导航而无需重新加载页面的架构。这种类型的应用程序通常被称为单页应用（SPA）。

SPA 通常会使用组件、路由、全局状态与异步边界，因此应预期按需包含 Vapor 兼容能力；“静态 JSX 可零 Rue 值运行时”不等于完整 SPA 零运行时。性能评估应以生产构建的实际模块图和压缩体积为准。

Rue 提供了核心库和[全面的工具支持](/guide/guide/scaling-up/tooling)，为构建现代 SPA 提供令人惊叹的开发者体验，包括：

- 客户端路由器
- 极速的构建工具链
- IDE 支持
- 浏览器开发者工具
- TypeScript 集成
- 测试工具

SPA 通常需要后端暴露 API 端点——但你也可以将 Rue 与 [Inertia.js](https://inertiajs.com) 等解决方案配对，在保留以服务器为中心的开发模型的同时获得 SPA 的好处。

## 超越网络 {#beyond-the-web}

虽然 Rue 主要是为构建 Web 应用程序而设计的，但它绝不仅限于浏览器。你可以：

- 使用 [Electron](https://www.electronjs.org/) 或 [Wails](https://wails.io) 构建桌面应用程序
- 使用 [Ionic Rue](https://ionicframework.com/docs/rue/overview) 构建移动应用程序
- 使用 [Quasar](https://quasar.dev/) 或 [Tauri](https://tauri.app) 从同一代码库构建桌面和移动应用程序
- 使用 [TresJS](https://tresjs.org/) 构建 3D WebGL 体验
- 使用 Rue 的[自定义渲染器 API](/api/api/custom-renderer) 构建自定义渲染器，如[终端](https://github.com/rue-terminal/rue-termui)！
