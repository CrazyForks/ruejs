---
name: rue
description: Use when generating Rue components, hooks, pages, examples, migrations, or when comparing Rue with Vue 3 and React.
---

# Rue Code Generation Guide

Arguments:

- $ARGUMENTS: Optional task description, feature name, or source framework to translate from

Use this skill whenever the user asks for Rue code, Rue examples, or framework comparisons. The goal is to keep generated code in Rue idioms instead of drifting into Vue 3 SFC syntax or React-only patterns.

Rue also supports JSX directive attributes in TSX, including `v-if`, `v-else`, `v-for`, `v-pre`, `r-if`, `r-for`, and `r-pre`. When the user asks for directive examples, or when the surrounding file already uses this style, generate them as Rue JSX directives rather than rewriting everything to plain `.map()` and ternaries.

## Core Mental Model

Rue is best treated as:

- React-style JSX/TSX component authoring
- React-compatible hooks such as `useState`, `#sym:useEffect`, `useMemo`, `useCallback`, and `useRef` when matching existing code style
- Vue-style fine-grained reactivity with `ref`, `reactive`, and `computed`
- Optional lower-level `signal` API for getter/setter style state
- Rue-specific runtime and mount flow, typically through `useApp(...).mount(...)`

Default preference when generating code:

1. Use JSX/TSX function components
2. Use `ref` / `reactive` / `computed` for most state examples
3. Use `watch`, `watchEffect`, and lifecycle hooks for reactive side effects
4. Use `@rue-js/router` for routing examples

## Hard Rules

1. **Do not generate Vue SFC syntax**
   - No `.vue` single-file components
   - No `<template>` / `<script setup>` / `<style scoped>`

- No Vue template-only syntax like `:class`, `@click`, `v-model`, or `{{ value }}`
- Rue JSX directives such as `v-if`, `v-for`, `v-pre`, and `r-pre` are valid only as TSX directive attributes, not inside Vue templates

2. **Do not default to React-only state patterns**
   - Do not force every example into `useState` + `useEffect`
   - Prefer Rue reactivity APIs for derived state and subscriptions

- Do not cross-wrap state containers: avoid putting `createStore()` / `defineStore()` stores, `ref`, `reactive`, or `computed` handles inside `useState`, and avoid re-wrapping `useState` state inside store state, `ref`, `reactive`, or `computed` just to pass it around
- Pick one owner for each piece of state: use `useState` for plain local values or a single local object shape, and use store / `ref` / `reactive` / `computed` directly when the surrounding code already depends on Rue reactivity primitives

- Rue also supports React-style hooks such as `#sym:useEffect`, `useMemo`, `useCallback`, and `useRef`; use them when the user asks for React-like Rue code or when matching existing local style

3. **Generate Rue imports**
   - Import runtime APIs from `@rue-js/rue`
   - Import routing APIs from `@rue-js/router`

4. **Use JSX event props and plain JavaScript expressions**
   - Use `onClick`, `onInput`, `onChange`

- By default, use ternary expressions, `&&`, and `.map()` for conditional rendering and lists
- If the user asks for Rue directive syntax, or the file already uses directive style, generate `v-if`, `v-for`, `v-pre`, `r-pre`, `r-if`, and `r-for` directly in TSX

5. **Prefer explicit form bindings**
   - Use `value` + `onInput` or `checked` + `onChange`
   - Do not generate `v-model`

6. **Component communication uses props and callbacks**
   - No `defineProps`, `defineEmits`, or Vue emits option objects
   - Pass callback props such as `onSubmit`, `onChange`, `onSelect`

7. **Bootstrapping should look like Rue**
   - For app entry examples, prefer `useApp(App).mount('#app')`

## Rue vs Vue 3

Similarities:

- Both support `ref`, `reactive`, `computed`, `watch`, `watchEffect`
- Both favor fine-grained reactive updates
- Both can express lifecycle work with dedicated hooks such as `onMounted`

Key differences:

- Rue writes UI with JSX/TSX, not Vue templates
- Rue components are function components, not SFCs
- Rue uses JSX props like `className`, `onClick`, and `{expr}`
- Rue can express loops and conditionals with normal JSX expressions, and also supports TSX directives like `v-if` and `v-for`
- Two-way binding is written manually with event handlers, not `v-model`

Vue-to-Rue translation example:

Wrong for Rue:

```vue
<template>
  <button @click="count++">{{ count }}</button>
</template>

<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>
```

Correct Rue version:

```tsx
import { type FC, ref } from '@rue-js/rue'

const Counter: FC = () => {
  const count = ref(0)

  return <button onClick={() => count.value++}>{count.value}</button>
}

export default Counter
```

## Rue vs React

Similarities:

- JSX/TSX component authoring
- Function components
- Props and callback-based component composition
- Familiar DOM event names like `onClick` and `onInput`
- Supports React-like hooks including `useState`, `#sym:useEffect`, `useMemo`, `useCallback`, and `useRef`

Key differences:

- Rue does not need React's immutable state style for every example
- Derived state should usually use `computed`, not ad-hoc `useMemo` everywhere
- Reactive side effects can use `watch` / `watchEffect`, and Rue also supports `#sym:useEffect` when a React-like dependency-array style is the better match
- Rue commonly uses `ref` / `reactive` / `signal` instead of only `useState`
- App mounting typically uses `useApp`, not `createRoot(...).render(...)`

React-to-Rue translation example:

React style:

```tsx
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

Preferred Rue version:

```tsx
import { type FC, ref } from '@rue-js/rue'

const Counter: FC = () => {
  const count = ref(0)

  return <button onClick={() => count.value++}>{count.value}</button>
}

export default Counter
```

React-like Rue version when explicitly requested:

```tsx
import { type FC, useState } from '@rue-js/rue'

const Counter: FC = () => {
  const [count, setCount] = useState(0)

  return <button onClick={() => setCount(count.value + 1)}>{count.value}</button>
}

export default Counter
```

React-like effect example supported in Rue:

```tsx
import { type FC, useEffect, useRef, useState } from '@rue-js/rue'

const SearchPanel: FC = () => {
  const [keyword, setKeyword] = useState('')
  const requestVersionRef = useRef(0)

  useEffect(() => {
    requestVersionRef.current += 1
    console.log('keyword =', keyword.value, 'request =', requestVersionRef.current)
  }, [() => keyword.value])

  return (
    <input
      value={keyword.value}
      onInput={event => {
        setKeyword((event.target as HTMLInputElement).value)
      }}
      placeholder="搜索关键词"
    />
  )
}

export default SearchPanel
```

## Preferred Patterns

### JSX Directives

Rue supports directive-style TSX when the example is specifically about directives or when the surrounding file already uses that style.

Prefer these forms:

- `v-if={condition}` and `v-else` for conditional directive examples
- `v-for="item in list"` or `v-for="(item, index) in list"` for array and numeric iteration
- `r-for="(value, key) in object"` for object iteration examples
- `v-pre` and `r-pre` when showing raw directive text or skipping directive compilation in a subtree

Directive example:

```tsx
import { computed, type FC, ref } from '@rue-js/rue'

const profileMeta = {
  framework: 'Rue',
  renderer: 'Vapor',
}

const DirectiveDemo: FC = () => {
  const phase = ref<'draft' | 'published'>('draft')
  const count = ref(3)
  const items = computed(() => [
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
  ])

  return (
    <div className="grid gap-4">
      <div className="rounded-box border border-base-300 p-4">
        <span v-if={phase.value === 'draft'}>当前阶段：{phase.value}</span>
        <span v-else>当前阶段：{phase.value}</span>
      </div>

      <ul className="list rounded-box bg-base-100">
        <li v-for="(item, index) in items.get()" key={item.id} className="list-row">
          {index + 1}. {item.name}
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <span r-for="(value, key) in profileMeta" key={key} className="badge badge-outline">
          {key}: {value}
        </span>
      </div>

      <div v-pre className="rounded-box border border-dashed border-base-300 p-4">
        <span v-if={phase.value === 'draft'}>{'{{ phase.value }}'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span v-for="step in count.value" key={step} className="badge badge-primary">
          Step {step}
        </span>
      </div>
    </div>
  )
}

export default DirectiveDemo
```

Directive generation rules:

- Keep directive syntax on TSX elements, not in Vue template blocks
- Add `key` for repeated nodes when the example iterates arrays or objects
- Prefer `r-for` for object iteration examples and `v-for` for arrays or numeric ranges
- Use `v-pre` or `r-pre` only when the example needs to preserve directive-looking text or skip directive expansion in that subtree

### State

Prefer this for general examples:

```tsx
import { type FC, computed, reactive, ref } from '@rue-js/rue'

const ProfileCard: FC = () => {
  const count = ref(0)
  const profile = reactive({ name: 'Rue', city: 'Shanghai' })
  const label = computed(() => `${profile.name}: ${count.value}`)

  return (
    <section>
      <h2>{label.value}</h2>
      <p>{profile.city}</p>
      <button onClick={() => count.value++}>增加</button>
    </section>
  )
}

export default ProfileCard
```

Avoid cross-wrapping reactive containers:

- Do not write `const [state] = useState(() => ({ store, count, summary }))` when `store` comes from `defineStore()`, `count` is a `ref`, or `summary` is a `computed`
- Do not place `useState` return values into store state, `reactive(...)`, or `computed(...)` only to expose them through another container
- If a component already has a Rue store or reactive primitives, keep them at setup scope and read them directly in JSX
- If a component truly wants `useState`, keep that state plain and local instead of mixing ownership with store / `ref` / `reactive` / `computed`

### Effects and Lifecycle

Prefer this for subscriptions or reactive reactions:

```tsx
import { type FC, onMounted, ref, watchEffect } from '@rue-js/rue'

const SearchBox: FC = () => {
  const keyword = ref('')

  onMounted(() => {
    console.log('mounted')
  })

  watchEffect(() => {
    console.log('keyword =', keyword.value)
  })

  return (
    <input
      value={keyword.value}
      onInput={event => {
        keyword.value = (event.target as HTMLInputElement).value
      }}
      placeholder="请输入关键词"
    />
  )
}

export default SearchBox
```

If the surrounding code already uses React-like hooks, this is also valid Rue code:

```tsx
import { type FC, useEffect, useRef, useState } from '@rue-js/rue'

const SearchBox: FC = () => {
  const [keyword, setKeyword] = useState('')
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    console.log('keyword =', keyword.value)

    return () => {
      mountedRef.current = false
    }
  }, [() => keyword.value])

  return (
    <input
      value={keyword.value}
      onInput={event => {
        setKeyword((event.target as HTMLInputElement).value)
      }}
      placeholder="请输入关键词"
    />
  )
}

export default SearchBox
```

### App Entry

Prefer this for runnable examples:

```tsx
import { type FC, ref, useApp, useError } from '@rue-js/rue'

const App: FC = () => {
  const count = ref(0)

  return <button onClick={() => count.value++}>点击次数：{count.value}</button>
}

useError({ overlay: true, console: true })
useApp(App).mount('#app')
```

## Common Mistakes To Avoid

- Generating Vue SFC or template syntax instead of Rue TSX directives
- Generating `v-model`, `:class`, `@click`, or `{{ value }}` as if the file were a Vue template
- Generating React-only imports from `react` inside Rue examples
- Using `createRoot` or `ReactDOM.render` in Rue app entry files
- Replacing simple `computed` values with manual effect bookkeeping
- Wrapping Rue store instances, `computed` handles, `ref`s, or `reactive` objects inside `useState`, or wrapping `useState` state back into those containers
- Assuming Rue lacks `#sym:useEffect` / `useMemo` / `useCallback` / `useRef` and rewriting existing React-like Rue code unnecessarily
- Avoiding valid Rue JSX directives like `v-if`, `v-for`, `v-pre`, or `r-pre` when the user explicitly asks for directive examples
- Writing examples without `key` when rendering lists
- Mixing Vue template syntax like `{{ value }}` into JSX

## Output Checklist

Before returning Rue code, verify:

1. The example is JSX/TSX, not Vue SFC
2. Imports come from `@rue-js/rue` and related Rue packages
3. Events use JSX props like `onClick` and `onInput`
4. State APIs match Rue idioms
5. Mounting and routing examples use Rue APIs
6. If directives are used, they are Rue JSX directive attributes rather than Vue template syntax
