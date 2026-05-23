import { useComponent } from '@rue-js/rue'
import { createRouter, createWebHistory } from '@rue-js/router'

type RouteRecord = { path: string; component: any }

const routes: RouteRecord[] = [
  { path: '/about', component: useComponent(() => import('../pages/About')) },
  { path: '/posts', component: useComponent(() => import('../pages/PostsList')) },
  { path: '/posts/:id', component: useComponent(() => import('../pages/PostDetail')) },
  { path: '/use-cart', component: useComponent(() => import('../pages/UseCart')) },
  { path: '/vapor', component: useComponent(() => import('../pages/Vapor')) },
  { path: '/vapor-jsx', component: useComponent(() => import('../pages/VaporJSXDemo')) },
  { path: '/jsx', component: useComponent(() => import('../pages/jsx/Index')) },
  {
    path: '/jsx/basic-elements',
    component: useComponent(() => import('../pages/jsx/BasicElements')),
  },
  { path: '/jsx/expressions', component: useComponent(() => import('../pages/jsx/Expressions')) },
  {
    path: '/jsx/attributes-and-props',
    component: useComponent(() => import('../pages/jsx/AttributesAndProps')),
  },
  { path: '/design/space', component: useComponent(() => import('../pages/design/Space')) },
  {
    path: '/design/auto-complete',
    component: useComponent(() => import('../pages/design/AutoComplete')),
  },
  { path: '/design/select', component: useComponent(() => import('../pages/design/Select')) },
  { path: '/design/tree', component: useComponent(() => import('../pages/design/Tree')) },
  {
    path: '/design/tree-select',
    component: useComponent(() => import('../pages/design/TreeSelect')),
  },
  {
    path: '/design/time-picker',
    component: useComponent(() => import('../pages/design/TimePicker')),
  },
  {
    path: '/design/color-picker',
    component: useComponent(() => import('../pages/design/ColorPicker')),
  },
  {
    path: '/design/descriptions',
    component: useComponent(() => import('../pages/design/Descriptions')),
  },
  { path: '/design/qr-code', component: useComponent(() => import('../pages/design/QRCode')) },
  { path: '/design/segmented', component: useComponent(() => import('../pages/design/Segmented')) },
  { path: '/design/transfer', component: useComponent(() => import('../pages/design/Transfer')) },
  { path: '/design/tour', component: useComponent(() => import('../pages/design/Tour')) },
  {
    path: '/design/skeleton',
    component: useComponent(() => import('../pages/design/Skeleton')),
  },
  { path: '/design/flex', component: useComponent(() => import('../pages/design/Flex')) },
  { path: '/design/splitter', component: useComponent(() => import('../pages/design/Splitter')) },
  { path: '/design/stack', component: useComponent(() => import('../pages/design/Stack')) },
  { path: '/design/steps', component: useComponent(() => import('../pages/design/Steps')) },
  { path: '/design/swap', component: useComponent(() => import('../pages/design/Swap')) },
  { path: '/jsx/spread-props', component: useComponent(() => import('../pages/jsx/SpreadProps')) },
  {
    path: '/jsx/conditional-rendering',
    component: useComponent(() => import('../pages/jsx/ConditionalRendering')),
  },
  {
    path: '/jsx/v-if-r-if',
    component: useComponent(() => import('../pages/jsx/VIfAndRIf')),
  },
  {
    path: '/jsx/v-show-r-show',
    component: useComponent(() => import('../pages/jsx/VShowAndRShow')),
  },
  {
    path: '/jsx/v-pre-r-pre',
    component: useComponent(() => import('../pages/jsx/VPreAndRPre')),
  },
  {
    path: '/jsx/v-once-r-once',
    component: useComponent(() => import('../pages/jsx/VOnceAndROnce')),
  },
  {
    path: '/jsx/v-memo-r-memo',
    component: useComponent(() => import('../pages/jsx/VMemoAndRMemo')),
  },
  {
    path: '/jsx/v-text-r-text',
    component: useComponent(() => import('../pages/jsx/VTextAndRText')),
  },
  {
    path: '/jsx/v-html-r-html',
    component: useComponent(() => import('../pages/jsx/VHtmlAndRHtml')),
  },
  {
    path: '/jsx/v-on-r-on',
    component: useComponent(() => import('../pages/jsx/VOnAndROn')),
  },
  {
    path: '/jsx/v-model-r-model',
    component: useComponent(() => import('../pages/jsx/VModelAndRModel')),
  },
  {
    path: '/jsx/lists-and-keys',
    component: useComponent(() => import('../pages/jsx/ListsAndKeys')),
  },
  {
    path: '/jsx/v-for-r-for',
    component: useComponent(() => import('../pages/jsx/VForAndRFor')),
  },
  {
    path: '/jsx/template',
    component: useComponent(() => import('../pages/jsx/TemplateDemo')),
  },
  { path: '/jsx/fragments', component: useComponent(() => import('../pages/jsx/Fragments')) },
  { path: '/jsx/children', component: useComponent(() => import('../pages/jsx/Children')) },
  { path: '/jsx/components', component: useComponent(() => import('../pages/jsx/Components')) },
  {
    path: '/jsx/dynamic-component',
    component: useComponent(() => import('../pages/jsx/DynamicComponent')),
  },
  {
    path: '/jsx/suspense',
    component: useComponent(() => import('../pages/jsx/SuspenseDemo')),
  },
  {
    path: '/jsx/keep-alive',
    component: useComponent(() => import('../pages/jsx/KeepAliveDemo')),
  },
  { path: '/jsx/events', component: useComponent(() => import('../pages/jsx/Events')) },
  {
    path: '/jsx/controlled-inputs',
    component: useComponent(() => import('../pages/jsx/ControlledInputs')),
  },
  { path: '/jsx/refs', component: useComponent(() => import('../pages/jsx/Refs')) },
  {
    path: '/examples/hello-world',
    component: useComponent(() => import('../pages/examples/HelloWorld')),
  },
  {
    path: '/examples/reactive-counter',
    component: useComponent(() => import('../pages/examples/ReactiveCounter')),
  },
  {
    path: '/examples/shallow-ref',
    component: useComponent(() => import('../pages/examples/ShallowRef')),
  },
  {
    path: '/examples/next-tick',
    component: useComponent(() => import('../pages/examples/NextTick')),
  },
  {
    path: '/examples/render-counter',
    component: useComponent(() => import('../pages/examples/RenderCounter')),
  },
  {
    path: '/examples/use-state-counter',
    component: useComponent(() => import('../pages/examples/UseStateCounter')),
  },
  {
    path: '/examples/basic-todo-list',
    component: useComponent(() => import('../pages/examples/BasicTodoList')),
  },
  {
    path: '/examples/editable-user-profile',
    component: useComponent(() => import('../pages/examples/EditableUserProfile')),
  },
  {
    path: '/examples/map-list-rendering',
    component: useComponent(() => import('../pages/examples/MapListRendering')),
  },
  {
    path: '/examples/react-style-conditional',
    component: useComponent(() => import('../pages/examples/ReactStyleConditional')),
  },
  {
    path: '/examples/child-to-parent-notify',
    component: useComponent(() => import('../pages/examples/ChildToParentNotify')),
  },
  {
    path: '/examples/parent-child-counter-control',
    component: useComponent(() => import('../pages/examples/ParentChildCounterControl')),
  },
  {
    path: '/examples/component-v-model',
    component: useComponent(() => import('../pages/examples/ComponentVModel')),
  },
  {
    path: '/examples/named-v-model',
    component: useComponent(() => import('../pages/examples/NamedVModel')),
  },
  {
    path: '/examples/component-emit',
    component: useComponent(() => import('../pages/examples/ComponentEmit')),
  },
  {
    path: '/examples/use-state-array',
    component: useComponent(() => import('../pages/examples/UseStateArray')),
  },
  {
    path: '/examples/use-state-object',
    component: useComponent(() => import('../pages/examples/UseStateObject')),
  },
  {
    path: '/examples/local-counter',
    component: useComponent(() => import('../pages/examples/LocalCounter')),
  },
  {
    path: '/examples/local-todo-list',
    component: useComponent(() => import('../pages/examples/LocalTodoList')),
  },
  {
    path: '/examples/hello-children',
    component: useComponent(() => import('../pages/examples/HelloChildren')),
  },
  {
    path: '/examples/basic-children-box',
    component: useComponent(() => import('../pages/examples/BasicChildrenBox')),
  },
  {
    path: '/examples/nested-children-box',
    component: useComponent(() => import('../pages/examples/NestedChildrenBox')),
  },
  {
    path: '/examples/layout-children',
    component: useComponent(() => import('../pages/examples/LayoutChildren')),
  },
  {
    path: '/examples/handling-input',
    component: useComponent(() => import('../pages/examples/HandlingInput')),
  },
  {
    path: '/examples/attribute-bindings',
    component: useComponent(() => import('../pages/examples/AttributeBindings')),
  },
  {
    path: '/examples/conditionals-and-loops',
    component: useComponent(() => import('../pages/examples/ConditionalsAndLoops')),
  },
  {
    path: '/examples/form-bindings',
    component: useComponent(() => import('../pages/examples/FormBindings')),
  },
  {
    path: '/examples/simple-component',
    component: useComponent(() => import('../pages/examples/SimpleComponent')),
  },
  {
    path: '/examples/reactive-props-destructure',
    component: useComponent(() => import('../pages/examples/ReactivePropsDestructure')),
  },
  {
    path: '/examples/freeze-compiler-trap',
    component: useComponent(() => import('../pages/examples/FreezeCompilerTrap')),
  },
  {
    path: '/examples/props-setup-boundary',
    component: useComponent(() => import('../pages/examples/PropsSetupBoundary')),
  },
  {
    path: '/examples/slots',
    component: useComponent(() => import('../pages/examples/Slots')),
  },
  {
    path: '/examples/web-components',
    component: useComponent(() => import('../pages/examples/WebComponents')),
  },
  {
    path: '/examples/fetching-data',
    component: useComponent(() => import('../pages/examples/FetchingData')),
  },
  {
    path: '/examples/resources',
    component: useComponent(() => import('../pages/examples/ResourceDemo')),
  },
  {
    path: '/examples/resources-jsx',
    component: useComponent(() => import('../pages/examples/ResourceJSX')),
  },
  {
    path: '/examples/context',
    component: useComponent(() => import('../pages/examples/Context')),
  },
  {
    path: '/examples/todo-app',
    component: useComponent(() => import('../pages/examples/TodoApp')),
  },
  {
    path: '/examples/markdown-editor',
    component: useComponent(() => import('../pages/examples/MarkdownEditor')),
  },
  {
    path: '/examples/sort-filter-grid',
    component: useComponent(() => import('../pages/examples/SortFilterGrid')),
  },
  {
    path: '/examples/tree-view',
    component: useComponent(() => import('../pages/examples/TreeView')),
  },
  {
    path: '/examples/svg-graph',
    component: useComponent(() => import('../pages/examples/SVGGraph')),
  },
  {
    path: '/examples/svg-shared-namespace',
    component: useComponent(() => import('../pages/examples/SVGSharedNamespace')),
  },
  { path: '/examples/modal', component: useComponent(() => import('../pages/examples/Modal')) },
  {
    path: '/examples/list-transition',
    component: useComponent(() => import('../pages/examples/ListTransition')),
  },
  { path: '/design/button', component: useComponent(() => import('../pages/design/Button')) },
  { path: '/design/anchor', component: useComponent(() => import('../pages/design/Anchor')) },
  { path: '/design/affix', component: useComponent(() => import('../pages/design/Affix')) },
  {
    path: '/design/typography',
    component: useComponent(() => import('../pages/design/Typography')),
  },
  { path: '/design/tabs', component: useComponent(() => import('../pages/design/Tabs')) },
  { path: '/design/alert', component: useComponent(() => import('../pages/design/Alert')) },
  { path: '/design/result', component: useComponent(() => import('../pages/design/Result')) },
  { path: '/design/empty', component: useComponent(() => import('../pages/design/Empty')) },
  { path: '/design/card', component: useComponent(() => import('../pages/design/Card')) },
  { path: '/design/calendar', component: useComponent(() => import('../pages/design/Calendar')) },
  { path: '/design/collapse', component: useComponent(() => import('../pages/design/Collapse')) },
  { path: '/design/countdown', component: useComponent(() => import('../pages/design/Countdown')) },
  {
    path: '/design/descriptions',
    component: useComponent(() => import('../pages/design/Descriptions')),
  },
  {
    path: '/design/hover-gallery',
    component: useComponent(() => import('../pages/design/HoverGallery')),
  },
  { path: '/design/kbd', component: useComponent(() => import('../pages/design/Kbd')) },
  { path: '/design/list', component: useComponent(() => import('../pages/design/List')) },
  { path: '/design/table', component: useComponent(() => import('../pages/design/Table')) },
  { path: '/design/chat', component: useComponent(() => import('../pages/design/Chat')) },
  { path: '/design/checkbox', component: useComponent(() => import('../pages/design/Checkbox')) },
  { path: '/design/badge', component: useComponent(() => import('../pages/design/Badge')) },
  { path: '/design/divider', component: useComponent(() => import('../pages/design/Divider')) },
  { path: '/design/diff', component: useComponent(() => import('../pages/design/Diff')) },
  { path: '/design/carousel', component: useComponent(() => import('../pages/design/Carousel')) },
  { path: '/design/dropdown', component: useComponent(() => import('../pages/design/Dropdown')) },
  { path: '/design/fab', component: useComponent(() => import('../pages/design/Fab')) },
  { path: '/design/modal', component: useComponent(() => import('../pages/design/Modal')) },
  { path: '/design/footer', component: useComponent(() => import('../pages/design/Footer')) },
  { path: '/design/fieldset', component: useComponent(() => import('../pages/design/Fieldset')) },
  { path: '/design/form', component: useComponent(() => import('../pages/design/Form')) },
  {
    path: '/design/file-input',
    component: useComponent(() => import('../pages/design/FileInput')),
  },
  { path: '/design/filter', component: useComponent(() => import('../pages/design/Filter')) },
  { path: '/design/grid', component: useComponent(() => import('../pages/design/Grid')) },
  { path: '/design/masonry', component: useComponent(() => import('../pages/design/Masonry')) },
  { path: '/design/drawer', component: useComponent(() => import('../pages/design/Drawer')) },
  { path: '/design/hero', component: useComponent(() => import('../pages/design/Hero')) },
  { path: '/design/indicator', component: useComponent(() => import('../pages/design/Indicator')) },
  { path: '/design/input', component: useComponent(() => import('../pages/design/Input')) },
  {
    path: '/design/input-number',
    component: useComponent(() => import('../pages/design/InputNumber')),
  },
  { path: '/design/join', component: useComponent(() => import('../pages/design/Join')) },
  { path: '/design/layout', component: useComponent(() => import('../pages/design/Layout')) },
  { path: '/design/label', component: useComponent(() => import('../pages/design/Label')) },
  { path: '/design/loading', component: useComponent(() => import('../pages/design/Loading')) },
  { path: '/design/mask', component: useComponent(() => import('../pages/design/Mask')) },
  {
    path: '/design/mockup-browser',
    component: useComponent(() => import('../pages/design/MockupBrowser')),
  },
  {
    path: '/design/mockup-code',
    component: useComponent(() => import('../pages/design/MockupCode')),
  },
  {
    path: '/design/mockup-phone',
    component: useComponent(() => import('../pages/design/MockupPhone')),
  },
  {
    path: '/design/mockup-window',
    component: useComponent(() => import('../pages/design/MockupWindow')),
  },
  { path: '/design/navbar', component: useComponent(() => import('../pages/design/Navbar')) },
  {
    path: '/design/pagination',
    component: useComponent(() => import('../pages/design/Pagination')),
  },
  { path: '/design/accordion', component: useComponent(() => import('../pages/design/Accordion')) },
  { path: '/design/avatar', component: useComponent(() => import('../pages/design/Avatar')) },
  { path: '/design/hover-3d', component: useComponent(() => import('../pages/design/Hover3D')) },
  { path: '/design/timeline', component: useComponent(() => import('../pages/design/Timeline')) },
  {
    path: '/design/text-rotate',
    component: useComponent(() => import('../pages/design/TextRotate')),
  },
  { path: '/design/status', component: useComponent(() => import('../pages/design/Status')) },
  { path: '/design/stat', component: useComponent(() => import('../pages/design/Stat')) },
  { path: '/design/progress', component: useComponent(() => import('../pages/design/Progress')) },
  {
    path: '/design/radial-progress',
    component: useComponent(() => import('../pages/design/RadialProgress')),
  },
  { path: '/design/radio', component: useComponent(() => import('../pages/design/Radio')) },
  { path: '/design/range', component: useComponent(() => import('../pages/design/Range')) },
  { path: '/design/rating', component: useComponent(() => import('../pages/design/Rating')) },
  {
    path: '/design/breadcrumbs',
    component: useComponent(() => import('../pages/design/Breadcrumbs')),
  },
  { path: '/design/link', component: useComponent(() => import('../pages/design/Link')) },
  { path: '/design/dock', component: useComponent(() => import('../pages/design/Dock')) },
  { path: '/design/menu', component: useComponent(() => import('../pages/design/Menu')) },
  { path: '/design/mentions', component: useComponent(() => import('../pages/design/Mentions')) },
  { path: '/design/textarea', component: useComponent(() => import('../pages/design/Textarea')) },
  {
    path: '/design/theme-controller',
    component: useComponent(() => import('../pages/design/ThemeController')),
  },
  {
    path: '/design/message',
    component: useComponent(() => import('../pages/design/Message')),
  },
  {
    path: '/design/notification',
    component: useComponent(() => import('../pages/design/Notification')),
  },
  { path: '/design/toast', component: useComponent(() => import('../pages/design/Toast')) },
  { path: '/design/toggle', component: useComponent(() => import('../pages/design/Toggle')) },
  {
    path: '/design/popconfirm',
    component: useComponent(() => import('../pages/design/Popconfirm')),
  },
  { path: '/design/popover', component: useComponent(() => import('../pages/design/Popover')) },
  { path: '/design/tooltip', component: useComponent(() => import('../pages/design/Tooltip')) },
  { path: '/design/watermark', component: useComponent(() => import('../pages/design/Watermark')) },
  { path: '/design/validator', component: useComponent(() => import('../pages/design/Validator')) },
  {
    path: '/design/:slug',
    component: useComponent(() => import('../pages/design/DesignPlaceholder')),
  },
  { path: '/e2e/tdz', component: useComponent(() => import('../pages/e2e/TDZMemo')) },
  {
    path: '/e2e/router-unmount-a',
    component: useComponent(() => import('../pages/e2e/RouterUnmountProbeA')),
  },
  {
    path: '/e2e/router-unmount-b',
    component: useComponent(() => import('../pages/e2e/RouterUnmountProbeB')),
  },
  { path: '/', component: useComponent(() => import('../pages/site/SiteHome')) },
  {
    path: '/guide/:path(.*)',
    component: useComponent(() => import('../pages/site/GuideDocDetail')),
  },
  { path: '/api/:path(.*)', component: useComponent(() => import('../pages/site/ApiDocDetail')) },
  { path: '/page/:path(.*)', component: useComponent(() => import('../pages/site/PageDocDetail')) },
  { path: '/plugins', component: useComponent(() => import('../pages/site/PluginsIndex')) },
  { path: '/page', component: useComponent(() => import('../pages/site/DocsIndex')) },
  { path: '/report-data1', component: useComponent(() => import('../pages/report-data1/index')) },
  {
    path: '/report-bi-arch',
    component: useComponent(() => import('../pages/report-bi-arch/index')),
  },
]

export default createRouter({
  history: createWebHistory(),
  routes: routes,
})
