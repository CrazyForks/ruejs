# API 参考 {#api-reference}

本部分包含 Rue 所有 API 的参考文档。

## 全局 API {#global-api}

### 应用创建 {#application-creation}

- [useApp()](/api/application#useapp)

### 通用 {#general}

- [version](/api/general#version)
- [nextTick()](/api/general#nexttick)
- [useComponent()](/api/general#usecomponent)

## 组合式 API {#composition-api}

### 响应式：核心 {#reactivity-core}

- [ref()](/api/reactivity-core#ref)
- [computed()](/api/reactivity-core#computed)
- [reactive()](/api/reactivity-core#reactive)
- [readonly()](/api/reactivity-core#readonly)
- [watchEffect()](/api/reactivity-core#watcheffect)
- [watchPostEffect()](/api/reactivity-core#watchposteffect)
- [watchSyncEffect()](/api/reactivity-core#watchsynceffect)
- [watch()](/api/reactivity-core#watch)

### 响应式：工具 {#reactivity-utilities}

- [isRef()](/api/reactivity-utilities#isref)
- [unref()](/api/reactivity-utilities#unref)
- [toRef()](/api/reactivity-utilities#toref)
- [toValue()](/api/reactivity-utilities#tovalue)
- [toRefs()](/api/reactivity-utilities#torefs)
- [isProxy()](/api/reactivity-utilities#isproxy)
- [isReactive()](/api/reactivity-utilities#isreactive)
- [isReadonly()](/api/reactivity-utilities#isreadonly)

### 响应式：进阶 {#reactivity-advanced}

- [shallowRef()](/api/reactivity-advanced#shallowref)
- [triggerRef()](/api/reactivity-advanced#triggerref)
- [customRef()](/api/reactivity-advanced#customref)
- [shallowReactive()](/api/reactivity-advanced#shallowreactive)
- [shallowReadonly()](/api/reactivity-advanced#shallowreadonly)
- [toRaw()](/api/reactivity-advanced#toraw)
- [markRaw()](/api/reactivity-advanced#markraw)
- [effectScope()](/api/reactivity-advanced#effectscope)
- [getCurrentScope()](/api/reactivity-advanced#getcurrentscope)
- [onScopeDispose()](/api/reactivity-advanced#onscopedispose)

### 生命周期钩子 {#lifecycle-hooks}

- [onMounted()](/api/composition-api-lifecycle#onmounted)
- [onUpdated()](/api/composition-api-lifecycle#onupdated)
- [onUnmounted()](/api/composition-api-lifecycle#onunmounted)
- [onBeforeMount()](/api/composition-api-lifecycle#onbeforemount)
- [onBeforeUpdate()](/api/composition-api-lifecycle#onbeforeupdate)
- [onBeforeUnmount()](/api/composition-api-lifecycle#onbeforeunmount)
- [onErrorCaptured()](/api/composition-api-lifecycle#onerrorcaptured)
- [onRenderTracked()](/api/composition-api-lifecycle#onrendertracked)
- [onRenderTriggered()](/api/composition-api-lifecycle#onrendertriggered)
- [onActivated()](/api/composition-api-lifecycle#onactivated)
- [onDeactivated()](/api/composition-api-lifecycle#ondeactivated)
- [onServerPrefetch()](/api/composition-api-lifecycle#onserverprefetch)

## 内置组件 {#built-in-components}

- [Transition](/api/built-in-components#transition)
- [TransitionGroup](/api/built-in-components#transitiongroup)
- [KeepAlive](/api/built-in-components#keepalive)
- [Teleport](/api/built-in-components#teleport)
- [Suspense](/api/built-in-components#suspense)

## 内置指令 {#built-in-directives}

- [v-text](/api/built-in-directives#v-text)
- [v-html](/api/built-in-directives#v-html)
- [v-show](/api/built-in-directives#v-show)
- [v-if](/api/built-in-directives#v-if)
- [v-else](/api/built-in-directives#v-else)
- [v-else-if](/api/built-in-directives#v-else-if)
- [v-for](/api/built-in-directives#v-for)
- [v-on](/api/built-in-directives#v-on)
- [v-model](/api/built-in-directives#v-model)
- [v-slot](/api/built-in-directives#v-slot)
- [v-pre](/api/built-in-directives#v-pre)
- [v-once](/api/built-in-directives#v-once)
- [v-memo](/api/built-in-directives#v-memo)

## 高级 API {#advanced-apis}

- [渲染函数](/api/render-function)
- [TypeScript 工具类型](/api/utility-types)
- [自定义元素](/api/custom-elements)
