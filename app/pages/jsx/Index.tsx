import type { FC } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'
import SidebarPlayground from '../site/SidebarPlaygroundExample'

const Index: FC = () => (
  <SidebarPlayground>
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title">React JSX 语法目录</h2>
        <ul className="menu menu-sm bg-transparent rounded-box">
          <li>
            <RouterLink to="/jsx/basic-elements">基础元素与自闭合标签</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/expressions">表达式与插值</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/attributes-and-props">属性、className、style 与 Props</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/spread-props">对象展开属性（spread props）</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/conditional-rendering">条件渲染（?:、&&、null）</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-if-r-if">v-if / r-if 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-show-r-show">v-show / r-show 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-pre-r-pre">v-pre / r-pre 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-once-r-once">v-once / r-once 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-memo-r-memo">v-memo / r-memo 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-text-r-text">v-text / r-text 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-html-r-html">v-html / r-html 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-on-r-on">v-on / r-on 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-model-r-model">v-model / r-model 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/lists-and-keys">列表渲染与 key</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/v-for-r-for">v-for / r-for 指令</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/template">Template 无包装容器</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/fragments">
              Fragments（<>children</>）
            </RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/children">children 插槽与嵌套</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/components">组件与 Props 传递</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/dynamic-component">动态组件（Component）</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/suspense">Suspense 异步边界</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/keep-alive">KeepAlive 缓存组件</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/events">事件处理</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/controlled-inputs">受控输入</RouterLink>
          </li>
          <li>
            <RouterLink to="/jsx/refs">Refs 基础</RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </SidebarPlayground>
)

export default Index
