# @rue-js/design

Rue 的 JSX/TSX 组件库，样式基于 [daisyUI](https://daisyui.com/)。

## 安装

```sh
pnpm add @rue-js/design
```

## 根入口

根入口保留组件的具名导入，适合需要从同一入口使用多个组件的场景：

```tsx
import { Button, ColorPicker, InputNumber } from '@rue-js/design'
```

## 组件子路径

组件目录短名是稳定的公共子路径。例如，`button`、`input-number` 和 `color-picker` 均可直接导入：

```tsx
import Button, { type ButtonProps } from '@rue-js/design/button'
import InputNumber, { type InputNumberProps } from '@rue-js/design/input-number'
import ColorPicker, { Color, FORMAT_HEX, type ColorPickerProps } from '@rue-js/design/color-picker'
```

每个子路径的默认导出是对应组件；组件入口中的额外值和类型导出（如 `Color`、`FORMAT_HEX` 和 `ColorPickerProps`）也可从同一子路径使用。

直接使用组件子路径可以让 JavaScript 依赖边界更明确，并帮助打包器只包含实际使用的代码。这不会自动裁剪应用生成的 Tailwind/daisyUI CSS；CSS 体积仍由应用的 Tailwind/daisyUI 内容扫描和配置决定。
