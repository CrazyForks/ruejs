import type { FC } from '@rue-js/rue'
import { computed, ref } from '@rue-js/rue'
import { Button, Fieldset, Tabs, ThemeController } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'

type TabMode = 'preview' | 'code'
type ThemePresetName = 'default' | 'garden' | 'retro' | 'synthwave' | 'cyberpunk' | 'night' | 'coffee'
type AlgorithmMode = 'default' | 'dark' | 'compact' | 'darkCompact'
type ControllerDemoKind = 'toggle' | 'checkbox' | 'swap' | 'radio' | 'buttons'

interface ExampleBlockProps {
  title: string
  summary?: string
  tab: { value: TabMode }
  preview: () => any
  code: string
}

interface ApiRow {
  name: string
  description: string
  type: string
  defaultValue: string
}

interface PresetOption {
  value: ThemePresetName
  label: string
  description: string
}

interface ControllerPreviewProps {
  activeDemo: { value: ControllerDemoKind | null }
  activeTheme: { value: ThemePresetName | null }
}

const themePresetOptions: PresetOption[] = [
  { value: 'default', label: 'Default', description: '冷静蓝调，适合日常产品后台。' },
  { value: 'garden', label: 'Garden', description: '偏自然绿色，适合内容和协作场景。' },
  { value: 'retro', label: 'Retro', description: '纸感米色和棕色，适合叙事型页面。' },
  { value: 'synthwave', label: 'Synthwave', description: '高对比霓虹，适合强调品牌舞台感。' },
  { value: 'cyberpunk', label: 'Cyberpunk', description: '黄黑冲突感，适合强视觉实验场。' },
  { value: 'night', label: 'Night', description: '深海夜色，适合长时间阅读。' },
  { value: 'coffee', label: 'Coffee', description: '深咖棕调，适合沉浸式工作区。' },
]

const resolveAlgorithms = (mode: AlgorithmMode) => {
  switch (mode) {
    case 'dark':
      return [ThemeController.darkAlgorithm]
    case 'compact':
      return [ThemeController.compactAlgorithm]
    case 'darkCompact':
      return [ThemeController.darkAlgorithm, ThemeController.compactAlgorithm]
    default:
      return undefined
  }
}

const buildScopedThemeCode = () => {
  return [
    "const runtime = ThemeController.useToken({",
    "  theme: 'night',",
    "  algorithm: [ThemeController.darkAlgorithm, ThemeController.compactAlgorithm],",
    "  token: {",
    "    colors: { primary: '#38bdf8' },",
    "    radius: { box: '1.1rem' },",
    "  },",
    "})",
    '',
    "<ThemeController.Provider",
    "  theme=\"night\"",
    "  algorithm={[ThemeController.darkAlgorithm, ThemeController.compactAlgorithm]}",
    "  token={{ colors: { primary: '#38bdf8' }, radius: { box: '1.1rem' } }}",
    "  className=\"rounded-[2rem] border border-base-300 p-6\"",
    ">",
    "  <Button color=\"primary\">Publish</Button>",
    "</ThemeController.Provider>",
    '',
    "runtime.token.colors.primary // '#38bdf8'",
  ].join('\n')
}

const buildPresetCode = () => {
  return [
    "const token = ThemeController.getDesignToken({",
    "  theme: 'night',",
    "})",
    '',
    "token.colors.primary",
    "token.radius.box",
    "token.shadow.md",
  ].join('\n')
}

const buildProviderRenderCode = () => {
  return [
    "<ThemeController.Provider",
    "  theme=\"retro\"",
    "  render={(runtime) => (",
    "    <div>",
    "      {runtime.theme} | {runtime.token.colors.primary}",
    "    </div>",
    "  )}",
    "/>",
  ].join('\n')
}

const buildToggleCode = () => {
  return '<ThemeController className="toggle" value="synthwave" />'
}

const buildCheckboxCode = () => {
  return '<ThemeController className="checkbox" value="synthwave" />'
}

const buildSwapCode = () => {
  return [
    '<label className="swap swap-rotate">',
    '  <ThemeController value="synthwave" />',
    '  <span className="swap-off">Light</span>',
    '  <span className="swap-on">Dark</span>',
    '</label>',
  ].join('\n')
}

const buildRadioCode = () => {
  return '<ThemeController type="radio" name="theme-radios" className="radio radio-sm" value="retro" />'
}

const buildButtonGroupCode = () => {
  return [
    '<div className="join join-vertical sm:join-horizontal">',
    '  <ThemeController type="radio" name="theme-buttons" className="btn theme-controller join-item" value="default" aria-label="Default" />',
    '  <ThemeController type="radio" name="theme-buttons" className="btn theme-controller join-item" value="night" aria-label="Night" />',
    '  <ThemeController type="radio" name="theme-buttons" className="btn theme-controller join-item" value="coffee" aria-label="Coffee" />',
    '</div>',
  ].join('\n')
}

const controllerApiRows: ApiRow[] = [
  {
    name: 'className',
    description: '追加到 theme-controller 输入上的样式类，可与 toggle、checkbox、radio、btn 等 daisyUI 形态组合。',
    type: 'string',
    defaultValue: '-',
  },
  {
    name: 'theme',
    description: '语义化主题名别名，未传时回退到原生 value。',
    type: 'string',
    defaultValue: '-',
  },
  {
    name: 'type',
    description: '控制输入类型，兼容切换和单选两种主题选择方式。',
    type: "'checkbox' | 'radio'",
    defaultValue: "'checkbox'",
  },
  {
    name: '...native props',
    description: '继续透传 checked、name、onChange、disabled、autoComplete 等原生 input 属性。',
    type: 'HTML input props',
    defaultValue: '-',
  },
]

const providerApiRows: ApiRow[] = [
  {
    name: 'algorithm',
    description: '可传单个算法或算法数组，按顺序组合处理 token。',
    type: 'ThemeAlgorithm | ThemeAlgorithm[]',
    defaultValue: '-',
  },
  {
    name: 'as',
    description: '指定主题作用域根节点标签。',
    type: "'article' | 'div' | 'section' | 'span'",
    defaultValue: "'div'",
  },
  {
    name: 'baseToken',
    description: '从外部已有 token 继续派生，适合做二次主题生成。',
    type: 'ThemeDesignToken',
    defaultValue: '-',
  },
  {
    name: 'children',
    description: '作用域内部的正常内容节点。',
    type: 'any',
    defaultValue: '-',
  },
  {
    name: 'className',
    description: '主题容器自身类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    name: 'render',
    description: '显式 render prop，可拿到当前运行时 token 信息并返回节点。',
    type: '(runtime: ThemeTokenRuntime) => any',
    defaultValue: '-',
  },
  {
    name: 'style',
    description: '额外的作用域样式，支持对象和字符串，会与 token 生成的 CSS 变量一起合并。',
    type: 'Record<string, string | number> | string',
    defaultValue: '-',
  },
  {
    name: 'theme',
    description: '预设主题名，当前内置 default、garden、retro、synthwave、cyberpunk、night、coffee。',
    type: 'string',
    defaultValue: "'default'",
  },
  {
    name: 'token',
    description: '局部 token 覆盖，适合按场景微调主色、圆角、字号、阴影和密度。',
    type: 'ThemeTokenOverride',
    defaultValue: '-',
  },
]

const staticApiRows: ApiRow[] = [
  {
    name: 'compactAlgorithm',
    description: '把主题压缩成更高密度的控件和间距。',
    type: 'ThemeAlgorithm',
    defaultValue: '-',
  },
  {
    name: 'darkAlgorithm',
    description: '强制衍生暗色基底和深阴影层级。',
    type: 'ThemeAlgorithm',
    defaultValue: '-',
  },
  {
    name: 'defaultAlgorithm',
    description: '标准 token 整理算法，负责补齐 appearance、resolvedThemeName 等派生字段。',
    type: 'ThemeAlgorithm',
    defaultValue: '-',
  },
  {
    name: 'defaultConfig',
    description: 'Theme 的默认配置入口。',
    type: 'ThemeConfig',
    defaultValue: '-',
  },
  {
    name: 'defaultSeed',
    description: 'Rue Theme 的默认种子 token，可作为二次定制基线。',
    type: 'ThemeDesignToken',
    defaultValue: '-',
  },
  {
    name: 'getDesignToken(config)',
    description: '纯函数，返回合并预设、算法和覆盖后的最终 token。',
    type: '(config?: ThemeConfig) => ThemeDesignToken',
    defaultValue: '-',
  },
  {
    name: 'presets',
    description: '当前内置主题预设对象，可直接复用或做差量扩展。',
    type: 'Record<string, ThemeTokenOverride>',
    defaultValue: '-',
  },
  {
    name: 'useToken(config)',
    description: '返回 theme、token 和 cssVariables，适合页面级预览、调试面板和主题生成器。',
    type: '(config?: ThemeConfig) => ThemeTokenRuntime',
    defaultValue: '-',
  },
]

const ExampleBlock: FC<ExampleBlockProps> = ({ title, summary, tab, preview, code }) => {
  return (
    <div className="component-preview not-prose text-base-content my-6 lg:my-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
          {summary ? <p className="m-0 text-sm opacity-70">{summary}</p> : null}
        </div>
      </div>
      <Tabs
        style="box"
        items={[
          { key: 'preview', label: '预览' },
          { key: 'code', label: 'JSX代码' },
        ]}
        activeKey={tab.value}
        onChange={key => (tab.value = key as TabMode)}
        className="mb-3 mt-4"
      />
      {tab.value === 'preview' ? preview() : <Code className="mt-2" lang="tsx" code={code} />}
    </div>
  )
}

const ApiTable: FC<{ rows: ApiRow[] }> = ({ rows }) => {
  return (
    <div className="not-prose overflow-x-auto rounded-[1.5rem] border border-base-300 bg-base-100/90 shadow-sm">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>属性 / API</th>
            <th>说明</th>
            <th>类型</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{row.description}</td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                <code>{row.defaultValue}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ThemeSwatch: FC<{ label: string; value: string; text?: string }> = ({ label, value, text }) => {
  return (
    <div className="rounded-[1.15rem] border border-base-300/70 bg-base-100/80 p-3 shadow-sm">
      <div
        className="mb-3 h-12 rounded-[0.9rem] border border-base-300/70"
        style={{ backgroundColor: value, color: text ?? 'inherit' }}
      />
      <div className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  )
}

const TokenFact: FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className="rounded-[1.1rem] border border-base-300/70 bg-base-100/70 px-4 py-3 shadow-sm">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] opacity-60">{label}</div>
      <div className="mt-2 font-mono text-sm">{value}</div>
    </div>
  )
}

const SunIcon: FC = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

const MoonIcon: FC = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

const ThemeWorkbenchPreview: FC = () => {
  const activeTheme = ref<ThemePresetName>('night')
  const algorithmMode = ref<AlgorithmMode>('darkCompact')
  const primaryColor = ref('#38bdf8')
  const radiusBox = ref('1.1rem')
  const runtime = computed(() => ThemeController.useToken({
    theme: activeTheme.value,
    algorithm: resolveAlgorithms(algorithmMode.value),
    token: {
      colors: {
        primary: primaryColor.value,
      },
      radius: {
        box: radiusBox.value,
      },
    },
  }))
  const palette = computed(() => runtime.get().token.colors)

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="rounded-[1.75rem] border border-base-300 bg-gradient-to-b from-base-100 to-base-200/70 p-5 shadow-sm">
        <h3 className="m-0 text-base font-semibold">Theme Workbench</h3>
        <p className="mt-2 text-sm opacity-70">把预设、算法和 token 覆盖放到同一个工作台里，观察 Rue Theme 的组合结果。</p>

        <Fieldset className="mt-4 gap-3">
          <legend className="fieldset-legend text-xs uppercase tracking-[0.2em] opacity-60">Preset</legend>
          {themePresetOptions.map(option => (
            <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-[1rem] border border-base-300/70 bg-base-100/70 px-3 py-3">
              <input
                type="radio"
                name="theme-workbench-preset"
                className="radio radio-sm"
                value={option.value}
                checked={activeTheme.value === option.value}
                onInput={() => {
                  activeTheme.value = option.value
                }}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs opacity-65">{option.description}</span>
              </span>
            </label>
          ))}
        </Fieldset>

        <Fieldset className="mt-4 gap-2">
          <legend className="fieldset-legend text-xs uppercase tracking-[0.2em] opacity-60">Algorithms</legend>
          {[
            { value: 'default', label: 'Default' },
            { value: 'dark', label: 'Dark' },
            { value: 'compact', label: 'Compact' },
            { value: 'darkCompact', label: 'Dark + Compact' },
          ].map(option => (
            <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-[0.95rem] border border-base-300/70 bg-base-100/70 px-3 py-2.5">
              <input
                type="radio"
                name="theme-workbench-algorithm"
                className="radio radio-sm"
                value={option.value}
                checked={algorithmMode.value === option.value}
                onInput={() => {
                  algorithmMode.value = option.value as AlgorithmMode
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </Fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="rounded-[1rem] border border-base-300/70 bg-base-100/70 p-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Primary</span>
            <input
              type="color"
              value={primaryColor.value}
              onInput={(event: Event) => {
                primaryColor.value = (event.target as HTMLInputElement | null)?.value ?? primaryColor.value
              }}
              className="h-11 w-full cursor-pointer rounded-[0.9rem] border border-base-300 bg-transparent"
            />
            <span className="mt-2 block font-mono text-xs">{primaryColor.value}</span>
          </label>

          <label className="rounded-[1rem] border border-base-300/70 bg-base-100/70 p-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Box Radius</span>
            <input
              type="range"
              min="0.75"
              max="2.4"
              step="0.05"
              value={String(parseFloat(radiusBox.value))}
              onInput={(event: Event) => {
                const nextValue = (event.target as HTMLInputElement | null)?.value
                radiusBox.value = nextValue ? `${nextValue}rem` : radiusBox.value
              }}
              className="range range-sm"
            />
            <span className="mt-2 block font-mono text-xs">{radiusBox.value}</span>
          </label>
        </div>
      </div>

      <div className="grid gap-4">
        <ThemeController.Provider
          theme={activeTheme.value}
          algorithm={resolveAlgorithms(algorithmMode.value)}
          token={{
            colors: {
              primary: primaryColor.value,
            },
            radius: {
              box: radiusBox.value,
            },
          }}
          className="overflow-hidden rounded-[2rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200 p-6 shadow-[var(--rue-theme-shadow-md)]"
          render={scopedRuntime => (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.28em] opacity-60">Scoped Theme Island</div>
                    <h3 className="mt-3 text-2xl font-semibold">{scopedRuntime.theme} · {scopedRuntime.token.density}</h3>
                    <p className="mt-2 max-w-xl text-sm opacity-70">
                      这个区域只吃当前 Provider 的 token。它不会改动全站视觉，但能单独承载营销卡片、工作台模块或嵌套的品牌子空间。
                    </p>
                  </div>
                  <div className="badge badge-primary badge-lg">{scopedRuntime.token.appearance}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[var(--radius-box)] border border-base-300 bg-base-100/80 p-4 shadow-[var(--rue-theme-shadow-sm)]">
                    <div className="text-xs uppercase tracking-[0.22em] opacity-55">Release Health</div>
                    <div className="mt-3 text-3xl font-semibold">98.4%</div>
                    <div className="mt-2 text-sm opacity-65">主流程可用，适合直接发版。</div>
                  </div>
                  <div className="rounded-[var(--radius-box)] border border-base-300 bg-base-100/80 p-4 shadow-[var(--rue-theme-shadow-sm)]">
                    <div className="text-xs uppercase tracking-[0.22em] opacity-55">Primary</div>
                    <div className="mt-3 font-mono text-sm">{scopedRuntime.token.colors.primary}</div>
                    <div className="mt-2 text-sm opacity-65">当前作用域主色已经注入到 Provider。</div>
                  </div>
                  <div className="rounded-[var(--radius-box)] border border-base-300 bg-base-100/80 p-4 shadow-[var(--rue-theme-shadow-sm)]">
                    <div className="text-xs uppercase tracking-[0.22em] opacity-55">Surface Radius</div>
                    <div className="mt-3 font-mono text-sm">{scopedRuntime.token.radius.box}</div>
                    <div className="mt-2 text-sm opacity-65">用于卡片、面板和岛屿容器的圆角尺度。</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button color="primary">Publish</Button>
                  <Button color="secondary" type="outlined">Preview</Button>
                  <Button type="filled" color="accent">Theme Diff</Button>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-base-300 bg-base-100/75 p-5 shadow-[var(--rue-theme-shadow-sm)]">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Palette</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ThemeSwatch label="Primary" value={scopedRuntime.token.colors.primary} text={scopedRuntime.token.colors.primaryContent} />
                  <ThemeSwatch label="Secondary" value={scopedRuntime.token.colors.secondary} text={scopedRuntime.token.colors.secondaryContent} />
                  <ThemeSwatch label="Accent" value={scopedRuntime.token.colors.accent} text={scopedRuntime.token.colors.accentContent} />
                  <ThemeSwatch label="Base 100" value={scopedRuntime.token.colors.base100} text={scopedRuntime.token.colors.baseContent} />
                </div>
              </div>
            </div>
          )}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <TokenFact label="theme" value={runtime.get().theme} />
          <TokenFact label="appearance" value={runtime.get().token.appearance} />
          <TokenFact label="density" value={runtime.get().token.density} />
          <TokenFact label="colorScheme" value={runtime.get().token.colorScheme} />
        </div>
      </div>
    </div>
  )
}

const ThemePresetGalleryPreview: FC = () => {
  const activeTheme = ref<ThemePresetName>('default')
  const token = computed(() => ThemeController.getDesignToken({ theme: activeTheme.value }))

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Fieldset className="gap-2 rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
        <legend className="fieldset-legend">预设主题</legend>
        {themePresetOptions.map(option => (
          <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-[1rem] border border-base-300/70 bg-base-100/70 px-3 py-3">
            <input
              type="radio"
              name="theme-static-presets"
              className="radio radio-sm"
              value={option.value}
              checked={activeTheme.value === option.value}
              onInput={() => {
                activeTheme.value = option.value
              }}
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs opacity-65">{option.description}</span>
            </span>
          </label>
        ))}
      </Fieldset>

      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ThemeSwatch label="Primary" value={token.get().colors.primary} text={token.get().colors.primaryContent} />
          <ThemeSwatch label="Secondary" value={token.get().colors.secondary} text={token.get().colors.secondaryContent} />
          <ThemeSwatch label="Accent" value={token.get().colors.accent} text={token.get().colors.accentContent} />
          <ThemeSwatch label="Base" value={token.get().colors.base100} text={token.get().colors.baseContent} />
        </div>

        <div className="rounded-[1.6rem] border border-base-300 bg-base-100/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Token Snapshot</div>
              <div className="mt-2 text-lg font-semibold">{activeTheme.value}</div>
            </div>
            <div className="badge badge-outline">getDesignToken()</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <TokenFact label="radius.box" value={token.get().radius.box} />
            <TokenFact label="font.size" value={token.get().typography.size} />
            <TokenFact label="shadow.md" value={token.get().shadow.md} />
          </div>
        </div>
      </div>
    </div>
  )
}

const ThemeProviderRenderPreview: FC = () => {
  return (
    <ThemeController.Provider
      theme="retro"
      token={{
        colors: {
          primary: '#8b5e34',
        },
      }}
      render={runtime => (
        <div className="rounded-[1.6rem] border border-base-300 bg-base-100/85 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Render Prop Snapshot</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <TokenFact label="theme" value={runtime.theme} />
            <TokenFact label="primary" value={runtime.token.colors.primary} />
            <TokenFact label="appearance" value={runtime.token.appearance} />
          </div>
        </div>
      )}
    />
  )
}

const ThemeTogglePreview: FC<ControllerPreviewProps> = ({ activeDemo, activeTheme }) => {
  const isChecked = activeDemo.value === 'toggle' && activeTheme.value === 'synthwave'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="label-text">Default</span>
      <ThemeController
        data-testid="theme-toggle"
        className="toggle"
        value="synthwave"
        checked={isChecked}
        onChange={(event: Event) => {
          const nextChecked = (event.target as HTMLInputElement | null)?.checked === true
          if (nextChecked) {
            activeDemo.value = 'toggle'
            activeTheme.value = 'synthwave'
            return
          }
          if (activeDemo.value === 'toggle') {
            activeDemo.value = null
            activeTheme.value = null
          }
        }}
      />
      <span className="label-text">Synthwave</span>
      <span className="text-sm text-base-content/70">当前 controller 值：{isChecked ? 'synthwave' : '未激活'}</span>
    </div>
  )
}

const ThemeCheckboxPreview: FC<ControllerPreviewProps> = ({ activeDemo, activeTheme }) => {
  const isChecked = activeDemo.value === 'checkbox' && activeTheme.value === 'synthwave'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ThemeController
        data-testid="theme-checkbox"
        className="checkbox"
        value="synthwave"
        checked={isChecked}
        onChange={(event: Event) => {
          const nextChecked = (event.target as HTMLInputElement | null)?.checked === true
          if (nextChecked) {
            activeDemo.value = 'checkbox'
            activeTheme.value = 'synthwave'
            return
          }
          if (activeDemo.value === 'checkbox') {
            activeDemo.value = null
            activeTheme.value = null
          }
        }}
      />
      <span className="text-sm text-base-content/70">当前 controller 值：{isChecked ? 'synthwave' : '未激活'}</span>
    </div>
  )
}

const ThemeSwapPreview: FC<ControllerPreviewProps> = ({ activeDemo, activeTheme }) => {
  const isChecked = activeDemo.value === 'swap' && activeTheme.value === 'synthwave'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="swap swap-rotate text-base-content">
        <ThemeController
          data-testid="theme-swap"
          value="synthwave"
          checked={isChecked}
          onChange={(event: Event) => {
            const nextChecked = (event.target as HTMLInputElement | null)?.checked === true
            if (nextChecked) {
              activeDemo.value = 'swap'
              activeTheme.value = 'synthwave'
              return
            }
            if (activeDemo.value === 'swap') {
              activeDemo.value = null
              activeTheme.value = null
            }
          }}
        />
        <span className="swap-off inline-flex items-center gap-2"><SunIcon /> Light</span>
        <span className="swap-on inline-flex items-center gap-2"><MoonIcon /> Dark</span>
      </label>
      <span className="text-sm text-base-content/70">当前 controller 值：{isChecked ? 'synthwave' : '未激活'}</span>
    </div>
  )
}

const ThemeRadioPreview: FC<ControllerPreviewProps> = ({ activeDemo, activeTheme }) => {
  const selectedTheme = activeDemo.value === 'radio' ? activeTheme.value : null

  return (
    <Fieldset className="w-xs gap-2">
      {['default', 'retro', 'cyberpunk'].map(theme => (
        <label key={theme} className="flex cursor-pointer items-center gap-2">
          <ThemeController
            data-testid={`theme-radio-${theme}`}
            type="radio"
            name="theme-radios"
            className="radio radio-sm"
            value={theme}
            checked={selectedTheme === theme}
            onChange={() => {
              activeDemo.value = 'radio'
              activeTheme.value = theme as ThemePresetName
            }}
          />
          <span>{theme}</span>
        </label>
      ))}
      <p className="m-0 text-sm text-base-content/70">当前 controller 值：{selectedTheme ?? '未激活'}</p>
    </Fieldset>
  )
}

const ThemeButtonGroupPreview: FC<ControllerPreviewProps> = ({ activeDemo, activeTheme }) => {
  const selectedTheme = activeDemo.value === 'buttons' ? activeTheme.value : null

  return (
    <div className="space-y-3">
      <div className="join join-vertical sm:join-horizontal">
        {['default', 'night', 'coffee'].map(theme => (
          <ThemeController
            key={theme}
            type="radio"
            name="theme-buttons"
            value={theme}
            checked={selectedTheme === theme}
            onChange={() => {
              activeDemo.value = 'buttons'
              activeTheme.value = theme as ThemePresetName
            }}
            className="btn theme-controller join-item"
            aria-label={theme}
          />
        ))}
      </div>
      <div className="text-sm text-base-content/70">当前 controller 值：{selectedTheme ?? '未激活'}</div>
    </div>
  )
}

const ThemeControllerPage: FC = () => {
  const tabWorkbench = ref<TabMode>('preview')
  const tabPresets = ref<TabMode>('preview')
  const tabRender = ref<TabMode>('preview')
  const tabToggle = ref<TabMode>('preview')
  const tabCheckbox = ref<TabMode>('preview')
  const tabSwap = ref<TabMode>('preview')
  const tabRadio = ref<TabMode>('preview')
  const tabButtons = ref<TabMode>('preview')
  const activeControllerDemo = ref<ControllerDemoKind | null>(null)
  const activeControllerTheme = ref<ThemePresetName | null>(null)

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Theme 主题系统</h1>
        <p className="text-sm mt-3 mb-3">
          目录仍然叫 theme，公共导出名继续保持 <code>ThemeController</code>，但它现在不再只是一个 CSS-only 的输入控件。
          这一版把 Rue Theme 扩成了一个轻量主题系统：默认导出依旧兼容原有 controller，用来接住 daisyUI 主题切换模式；同时新增
          <code>Provider</code>、<code>getDesignToken</code>、<code>useToken</code> 和暗色 / 紧凑算法，让主题可以局部作用、组合派生、按场景覆盖。
        </p>
        <p className="text-sm mt-3 mb-3">
          这套 API 参考了 ant-design Theme 的组织方式，但视觉仍然保留 Rue 当前偏轻盈、偏实验的气质：你可以把它当成一个局部主题岛生成器，而不是整站强耦合配置中心。
        </p>

        <ExampleBlock
          title="Scoped theme workbench"
          summary="把预设主题、算法和 token override 合到一个工作台里，直接观察局部主题岛的真实样子。"
          tab={tabWorkbench}
          preview={() => <ThemeWorkbenchPreview />}
          code={buildScopedThemeCode()}
        />

        <ExampleBlock
          title="Preset snapshot"
          summary="通过 getDesignToken 直接抽取主题快照，不挂 Provider 也能做主题分析、导出和调试面板。"
          tab={tabPresets}
          preview={() => <ThemePresetGalleryPreview />}
          code={buildPresetCode()}
        />

        <ExampleBlock
          title="Provider render prop"
          summary="Rue 默认 children 不支持函数子节点，所以 ThemeProvider 提供显式 render prop 来读取运行时 token。"
          tab={tabRender}
          preview={() => <ThemeProviderRenderPreview />}
          code={buildProviderRenderCode()}
        />

        <div className="not-prose mt-12 grid gap-6 rounded-[2rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200/60 p-6 shadow-sm lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Controller modes</div>
            <h2 className="mt-3 mb-2 text-xl font-semibold">完整的输入模式矩阵</h2>
            <p className="m-0 text-sm opacity-70">
              下面这些示例保留了原来的 toggle、checkbox、swap、radio 四种 controller 写法，并额外补了按钮组模式，方便把 ThemeController 直接嵌进现有表单和筛选 UI。
              由于 daisyUI 的 theme-controller 天生就是页面级切换器，这里额外做了单一激活控制，避免多个 demo 同时 checked 时互相抢占全局主题。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-base-300 bg-base-100/80 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Static API quick use</div>
            <Code
              className="mt-3"
              lang="tsx"
              code={[
                "const token = ThemeController.getDesignToken({",
                "  theme: 'coffee',",
                "  algorithm: ThemeController.compactAlgorithm,",
                "})",
                '',
                "const runtime = ThemeController.useToken({ theme: 'coffee' })",
              ].join('\n')}
            />
          </div>
        </div>

        <ExampleBlock
          title="Theme Controller using a toggle"
          summary="最轻量的 controller 入口。"
          tab={tabToggle}
          preview={() => <ThemeTogglePreview activeDemo={activeControllerDemo} activeTheme={activeControllerTheme} />}
          code={buildToggleCode()}
        />

        <ExampleBlock
          title="Theme Controller using a checkbox"
          summary="适合塞进表单区或者设置面板。"
          tab={tabCheckbox}
          preview={() => <ThemeCheckboxPreview activeDemo={activeControllerDemo} activeTheme={activeControllerTheme} />}
          code={buildCheckboxCode()}
        />

        <ExampleBlock
          title="Theme Controller using a swap"
          summary="保留了原来的 swap 形式，并补上更完整的视觉提示。"
          tab={tabSwap}
          preview={() => <ThemeSwapPreview activeDemo={activeControllerDemo} activeTheme={activeControllerTheme} />}
          code={buildSwapCode()}
        />

        <ExampleBlock
          title="Theme Controller using radio inputs"
          summary="适合明确展示当前主题选择。"
          tab={tabRadio}
          preview={() => <ThemeRadioPreview activeDemo={activeControllerDemo} activeTheme={activeControllerTheme} />}
          code={buildRadioCode()}
        />

        <ExampleBlock
          title="Theme Controller using button group"
          summary="把 ThemeController 当作 join 按钮组使用，适合主题预设切换器。"
          tab={tabButtons}
          preview={() => <ThemeButtonGroupPreview activeDemo={activeControllerDemo} activeTheme={activeControllerTheme} />}
          code={buildButtonGroupCode()}
        />

        <div className="mt-12 space-y-8">
          <section>
            <h2>ThemeController API</h2>
            <ApiTable rows={controllerApiRows} />
          </section>

          <section>
            <h2>ThemeController.Provider API</h2>
            <ApiTable rows={providerApiRows} />
          </section>

          <section>
            <h2>Static Theme APIs</h2>
            <ApiTable rows={staticApiRows} />
          </section>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default ThemeControllerPage
