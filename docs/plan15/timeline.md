# Timeline

## 提示词
我们的 demo 和 API 太简单了，参考 ant-design 的 Timeline，把 Rue 的 Timeline 做成一次性增强：保持 Rue 自己的视觉风格，不照搬 ant-design 的视觉，但 API 和能力可以增强，尽可能复刻对应组件的核心功能；保留并融合现有 demo，不删除旧 demo，只做补强和重组；一次性写完；只修改 Timeline 相关文件，不要动其他组件。

## 参考路径

### ant-design 对应组件
- [ant-design-master/components/timeline](/Users/dyhb/code/ant-design-master/components/timeline)

### Swap 改造示范
- [packages/rue-design/src/components/swap/index.tsx](/Users/dyhb/code/rue/packages/rue-design/src/components/swap/index.tsx)
- [app/pages/design/Swap.tsx](/Users/dyhb/code/rue/app/pages/design/Swap.tsx)

### Rue 组件路径
- 组件实现：[packages/rue-design/src/components/timeline/index.tsx](/Users/dyhb/code/rue/packages/rue-design/src/components/timeline/index.tsx)
- 设计页：[app/pages/design/Timeline.tsx](/Users/dyhb/code/rue/app/pages/design/Timeline.tsx)

## 边界提示
1. 只改 Timeline 相关文件，不要顺手修改其他组件。
2. 保留 Rue 当前视觉风格；有 ant-design 对应组件时参考其功能组织、API 能力和 demo 丰富度，没有直接对应组件时参考 Swap 的增强方式。
3. 现有 demo 不能删除，只能融合、补强、重组，并且一次性完成当前组件改造。