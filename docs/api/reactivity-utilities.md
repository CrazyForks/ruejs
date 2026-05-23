# 响应式 API：工具 {#reactivity-api-utilities}

## isRef() {#isref} @todo

当前 Rue 运行时尚未提供 `isRef()`。

- **状态**

  本节保留为规划占位。Rue 后续如果提供该能力，会优先按照自身运行时对象模型设计，而不是直接照搬 Vue 的类型守卫签名。

  当前如果只是想把值规范化为普通值，应优先使用 [`unref()`](#unref) 或 [`toValue()`](#tovalue)。

## unref() {#unref}

如果参数形如 Rue 的 ref，则返回其 `.value`；否则返回参数本身。

- **类型**

  ```ts
  function unref<T = any>(obj: any): T
  ```

- **示例**

  ```ts
  function useFoo(x: number | Ref<number>) {
    const unwrapped = unref(x)
    // unwrapped 现在保证是 number 类型
  }
  ```

## toRef() {#toref} @todo

当前 Rue 运行时尚未提供 `toRef()`。

- **状态**

  本节保留为规划占位。现阶段如果你需要稳定的单值响应式句柄，应直接使用 [`ref()`](/api/api/reactivity-core#ref)、[`shallowRef()`](/api/api/reactivity-advanced#shallowref)、[`computed()`](/api/api/reactivity-core#computed) 或 [`toValue()`](#tovalue)。

## toValue() {#tovalue}

将值/refs/getters 规范化为值。这与 [unref()](#unref) 类似，但它还会规范化 getters。如果参数是 getter，它将被调用并返回其返回值。

这可以在[组合式函数](/guide/guide/reusability/composables)中用于规范化一个可以是值、ref 或 getter 的参数。

- **类型**

  ```ts
  function toValue<T>(source: T | Ref<T> | (() => T)): T
  ```

- **示例**

  ```js
  toValue(1) //       --> 1
  toValue(ref(1)) //  --> 1
  toValue(() => 1) // --> 1
  ```

  在组合式函数中规范化参数：

  ```ts
  import type { MaybeRefOrGetter } from '@rue-js/rue'

  function useFeature(id: MaybeRefOrGetter<number>) {
    watch(
      () => toValue(id),
      id => {
        // 响应 id 变化
      },
    )
  }

  // 这个组合式函数支持以下任何一种：
  useFeature(1)
  useFeature(ref(1))
  useFeature(() => 1)
  ```

## toRefs() {#torefs} @todo

当前 Rue 运行时尚未提供 `toRefs()`。

- **状态**

  本节保留为规划占位。当前如果需要从组合式函数返回多个响应式值，推荐直接返回一个由多个 `ref()` 组成的普通对象，而不是依赖对象到 refs 的批量转换。

## isProxy() {#isproxy} @todo

当前 Rue 运行时尚未提供 `isProxy()`。

- **状态**

  本节保留为规划占位。现阶段如果你只需要判断对象是否来自 Rue 的响应式代理，优先使用已提供的 [`isReactive()`](#isreactive)。

## isReactive() {#isreactive}

检查对象是否是由 [`reactive()`](/api/api/reactivity-core#reactive) 或 [`shallowReactive()`](/api/api/reactivity-advanced#shallowreactive) 创建的代理。

- **类型**

  ```ts
  function isReactive(value: unknown): boolean
  ```

## isReadonly() {#isreadonly} @todo

当前 Rue 运行时尚未提供 `isReadonly()`。

- **状态**

  本节保留为规划占位。Rue 后续如果提供该 API，会基于自身只读代理与计算句柄模型重新定义其判断边界。
