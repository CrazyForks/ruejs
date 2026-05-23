# swc-plugin-rue 单元测试拆分计划

当前基线

- swc-plugin-rue 库覆盖：regions 66.27%，lines 63.05%
- 当前最适合继续补的文件：element_text.rs、element_component.rs、vapor/block/children.rs、vapor/block/expr.rs
- 拆分原则：每个任务只覆盖一个小切口，优先补纯 helper 或单一路由分支；每完成一个任务只跑一次窄验证

建议验证方式

- 文件级任务完成后优先跑：cargo test --lib <module>
- 一组任务完成后再跑：cargo llvm-cov --lib --summary-only

## P0：element_text.rs

- [x] 任务 1：静态空值文本路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：render_text_between_with_watch 的 static empty 分支
  - 目标：断言会创建 text wrapper、append 到父节点、直接 set 空字符串、不会生成 watchEffect
  - 建议验证：cargo test --lib element_text

- [x] 任务 2：静态文本字面量路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：render_text_between_with_watch 的 static literal 分支
  - 目标：分别覆盖字符串字面量和数字字面量，断言直接 settextContent，不走 watchEffect
  - 建议验证：cargo test --lib element_text

- [x] 任务 3：once 上下文的动态文本路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：render_text_between_with_watch 的 once_depth > 0 分支
  - 目标：断言动态表达式只做一次 settextContent，不创建 watchEffect
  - 建议验证：cargo test --lib element_text

- [x] 任务 4：普通动态文本 watch 路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：render_text_between_with_watch 的默认动态分支
  - 目标：断言 wrapper 创建、append、watchEffect 包裹、watch 内部 settextContent 使用原始表达式
  - 建议验证：cargo test --lib element_text

- [x] 任务 5：append_normalized_jsx_text 的空文本跳过路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：append_normalized_jsx_text 的 txt.is_empty() 分支
  - 目标：输入只含空白或折叠后为空的文本，断言不生成任何语句
  - 建议验证：cargo test --lib element_text

- [x] 任务 6：append_normalized_jsx_text 的归一化文本插入路径
  - 文件：packages/swc-plugin-rue/src/element_text.rs
  - 范围：append_normalized_jsx_text 的正常 append 分支
  - 目标：断言 normalize*text 后会生成 *$createTextNode 和 append_child，文本值与归一化结果一致
  - 建议验证：cargo test --lib element_text

## P1：element_component.rs

- [x] 任务 7：单一静态文本 children 的直接挂载路径
  - 文件：packages/swc-plugin-rue/src/element_component.rs
  - 范围：lower_slot_value 对单一 JSXText child 的分支
  - 目标：断言文本 child 会降成字符串表达式，不额外包 slot vapor
  - 建议验证：cargo test --lib element_component

- [x] 任务 8：单一表达式 children 的 slot 判定路径
  - 文件：packages/swc-plugin-rue/src/element_component.rs
  - 范围：lower_slot_value / lower_expr_slot_value 对 JSXExprContainer 的分支
  - 目标：分别覆盖 plain expr、contains_jsx_in_expr expr、static empty expr
  - 建议验证：cargo test --lib element_component

- [x] 任务 9：slot carrier wrapper 与 Fragment children 透传路径
  - 文件：packages/swc-plugin-rue/src/element_component.rs
  - 范围：rewrite_component_children_to_props 中的 Fragment / Template / Slot carrier 分支
  - 目标：断言 carrier wrapper 不会多包一层，children 重写结果稳定
  - 建议验证：cargo test --lib element_component

- [x] 任务 10：组件 anchor 与 direct_render_expr 路径
  - 文件：packages/swc-plugin-rue/src/element_component.rs
  - 范围：build_component_element 的 direct render 与普通 anchor 渲染分支
  - 目标：断言直接渲染场景不会生成多余 watch，普通场景会生成 component anchor
  - 建议验证：cargo test --lib element_component

## P2：vapor/block/children.rs

- [x] 任务 11：文本与片段分派一致性
  - 文件：packages/swc-plugin-rue/src/vapor/block/children.rs
  - 范围：emit_children 的 JSXText / JSXFragment 分支
  - 目标：断言与 element_children 的空白与 fragment 展开策略保持一致
  - 建议验证：cargo test --lib vapor_block_children

- [x] 任务 12：表达式容器与嵌套元素分派一致性
  - 文件：packages/swc-plugin-rue/src/vapor/block/children.rs
  - 范围：emit_children 的 JSXExprContainer / JSXElement / JSXSpreadChild 分支
  - 目标：断言 expr_container handler 被走到、nested element 会 build、spread child 被忽略
  - 建议验证：cargo test --lib vapor_block_children

## P3：vapor/block/expr.rs

- [x] 任务 13：renderable call 判定与 empty deps memo 判定
  - 文件：packages/swc-plugin-rue/src/vapor/block/expr.rs
  - 范围：call_returns_jsx_renderable、is_empty_deps_memoized_jsx_expr 周边 helper
  - 目标：覆盖 useMemo、\_$vaporWithHookId、map callback 三类可渲染调用
  - 建议验证：cargo test --lib vapor_block_expr

- [x] 任务 14：条件与逻辑表达式的 slot rewrite 路径
  - 文件：packages/swc-plugin-rue/src/vapor/block/expr.rs
  - 范围：条件表达式、&&、||、?? 的 slot rewrite
  - 目标：断言 JSX 分支会转成 vapor slot，空值回退为 ""
  - 建议验证：cargo test --lib vapor_block_expr

- [x] 任务 15：once 上下文下的 slot flatten 路径
  - 文件：packages/swc-plugin-rue/src/vapor/block/expr.rs
  - 范围：jsx_element_to_slot_value_expr / jsx_fragment_to_slot_value_expr 的 once flatten 分支
  - 目标：断言 once 上下文下 watchEffect 会被 flatten，普通上下文保持原样
  - 建议验证：cargo test --lib vapor_block_expr

推荐执行顺序

1. 先做 P0 的 6 个 element_text 任务。
2. 再做 P2 的 vapor/block/children，两条任务能和这次 element_children 的断言模式复用。
3. 然后做 P3 的 vapor/block/expr，再决定是否进入 element_component 的更大切口。
4. element_component 放到最后做，因为它的 children 改写和 direct render 分支更深，返工概率更高。
