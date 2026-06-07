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

## toRef() {#toref}

基于一个响应式对象属性创建 ref。返回的 ref 与源属性保持双向同步：读取 `.value` 会读取源对象属性，写入 `.value` 会写回源对象属性。

也可以传入 ref、getter 或普通值来做单值规范化：已有 ref 会原样返回，getter 会被包装成只读 ref，普通值会被包装为独立 ref。

- **类型**

  ```ts
  function toRef<T>(value: Ref<T>): Ref<T>
  function toRef<T>(getter: () => T): Readonly<Ref<T>>
  function toRef<T>(value: T): Ref<T>
  function toRef<T extends object, K extends keyof T>(object: T, key: K): { value: T[K] }
  function toRef<T extends object, K extends keyof T, D>(
    object: T,
    key: K,
    defaultValue: D,
  ): { value: Exclude<T[K], undefined> | D }
  ```

- **示例**

  ```ts
  const state = reactive({ count: 1 })
  const count = toRef(state, 'count')

  count.value++
  console.log(state.count) // 2

  const doubled = toRef(() => count.value * 2)
  console.log(doubled.value) // 4
  ```

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

## toRefs() {#torefs}

将响应式对象的可枚举属性转换为一组 ref。这个 API 常用于从组合式函数返回响应式对象时保持解构后的响应性。

- **类型**

  ```ts
  function toRefs<T extends object>(
    object: T,
  ): {
    [K in keyof T]: { value: T[K] }
  }
  ```

- **示例**

  ```ts
  function useCounter() {
    const state = reactive({ count: 0, label: 'Rue' })
    return toRefs(state)
  }

  const { count, label } = useCounter()
  count.value++
  console.log(label.value)
  ```

## isProxy() {#isproxy}

检查对象是否是由 [`reactive()`](/api/api/reactivity-core#reactive)、[`readonly()`](/api/api/reactivity-core#readonly)、[`shallowReactive()`](/api/api/reactivity-advanced#shallowreactive) 或 [`shallowReadonly()`](/api/api/reactivity-advanced#shallowreadonly) 创建的 Rue 响应式代理。

- **类型**

  ```ts
  function isProxy(value: unknown): boolean
  ```

## isReactive() {#isreactive}

检查对象是否是由 [`reactive()`](/api/api/reactivity-core#reactive) 或 [`shallowReactive()`](/api/api/reactivity-advanced#shallowreactive) 创建的代理。

- **类型**

  ```ts
  function isReactive(value: unknown): boolean
  ```

## isReadonly() {#isreadonly}

- **类型**

  ```ts
  function isReadonly(value: unknown): boolean
  ```

检查对象是否是由 [`readonly()`](/api/api/reactivity-core#readonly)、
[`shallowReadonly()`](/api/api/reactivity-advanced#shallowreadonly) 或内部只读 props 包装创建的代理。
只读 `computed(() => value)` 句柄也会返回 `true`；带 `set` 的可写 computed 返回 `false`。
