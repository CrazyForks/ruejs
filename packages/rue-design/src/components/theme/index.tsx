/*
Theme 组件概述
- 默认导出仍是可直接渲染的 theme-controller 输入控件，兼容现有 daisyUI 用法。
- 额外挂载 Provider、主题算法、token 计算工具。
- Provider 通过 data-theme 与 CSS 变量做“作用域主题岛”，不依赖运行时 context，也能支持嵌套继承。
*/
import type { FC } from '@rue-js/rue'

type ThemeInputType = 'checkbox' | 'radio'
type ThemeAppearance = 'light' | 'dark'
type ThemeDensity = 'default' | 'compact'
type ThemeProviderTag = 'article' | 'div' | 'section' | 'span'

interface ThemeStyleRecord {
  [key: string]: string | number | undefined
}

/** ThemeColorTokens 接口。 */
export interface ThemeColorTokens {
  /** primary 配置项。 */
  primary: string
  /** primaryContent 配置项。 */
  primaryContent: string
  /** secondary 配置项。 */
  secondary: string
  /** secondaryContent 配置项。 */
  secondaryContent: string
  /** accent 配置项。 */
  accent: string
  /** accentContent 配置项。 */
  accentContent: string
  /** neutral 配置项。 */
  neutral: string
  /** neutralContent 配置项。 */
  neutralContent: string
  /** base100 配置项。 */
  base100: string
  /** base200 配置项。 */
  base200: string
  /** base300 配置项。 */
  base300: string
  /** baseContent 配置项。 */
  baseContent: string
  /** info 配置项。 */
  info: string
  /** infoContent 配置项。 */
  infoContent: string
  /** success 配置项。 */
  success: string
  /** successContent 配置项。 */
  successContent: string
  /** warning 配置项。 */
  warning: string
  /** warningContent 配置项。 */
  warningContent: string
  /** error 配置项。 */
  error: string
  /** errorContent 配置项。 */
  errorContent: string
}

/** ThemeRadiusTokens 接口。 */
export interface ThemeRadiusTokens {
  /** selector 配置项。 */
  selector: string
  /** field 配置项。 */
  field: string
  /** box 配置项。 */
  box: string
}

/** ThemeSizeTokens 接口。 */
export interface ThemeSizeTokens {
  /** selector 配置项。 */
  selector: string
  /** field 配置项。 */
  field: string
}

/** ThemeSpacingTokens 接口。 */
export interface ThemeSpacingTokens {
  /** xs 配置项。 */
  xs: string
  /** sm 配置项。 */
  sm: string
  /** md 配置项。 */
  md: string
  /** lg 配置项。 */
  lg: string
  /** xl 配置项。 */
  xl: string
}

/** ThemeTypographyTokens 接口。 */
export interface ThemeTypographyTokens {
  /** family 配置项。 */
  family: string
  /** monoFamily 配置项。 */
  monoFamily: string
  /** 组件尺寸。 */
  size: string
  /** lineHeight 配置项。 */
  lineHeight: string
}

/** ThemeShadowTokens 接口。 */
export interface ThemeShadowTokens {
  /** sm 配置项。 */
  sm: string
  /** md 配置项。 */
  md: string
  /** lg 配置项。 */
  lg: string
}

/** ThemeDesignToken 接口。 */
export interface ThemeDesignToken {
  /** themeName 配置项。 */
  themeName: string
  /** resolvedThemeName 配置项。 */
  resolvedThemeName?: string
  /** appearance 配置项。 */
  appearance: ThemeAppearance
  /** density 配置项。 */
  density: ThemeDensity
  /** colorScheme 配置项。 */
  colorScheme: ThemeAppearance
  /** colors 配置项。 */
  colors: ThemeColorTokens
  /** radius 配置项。 */
  radius: ThemeRadiusTokens
  /** 组件尺寸。 */
  size: ThemeSizeTokens
  /** spacing 配置项。 */
  spacing: ThemeSpacingTokens
  /** typography 配置项。 */
  typography: ThemeTypographyTokens
  /** shadow 配置项。 */
  shadow: ThemeShadowTokens
  /** borderWidth 配置项。 */
  borderWidth: string
  /** depth 配置项。 */
  depth: 0 | 1
  /** noise 配置项。 */
  noise: 0 | 1
}

/** ThemeTokenOverride 接口。 */
export interface ThemeTokenOverride {
  /** appearance 配置项。 */
  appearance?: ThemeAppearance
  /** density 配置项。 */
  density?: ThemeDensity
  /** colorScheme 配置项。 */
  colorScheme?: ThemeAppearance
  /** colors 配置项。 */
  colors?: Partial<ThemeColorTokens>
  /** radius 配置项。 */
  radius?: Partial<ThemeRadiusTokens>
  /** 组件尺寸。 */
  size?: Partial<ThemeSizeTokens>
  /** spacing 配置项。 */
  spacing?: Partial<ThemeSpacingTokens>
  /** typography 配置项。 */
  typography?: Partial<ThemeTypographyTokens>
  /** shadow 配置项。 */
  shadow?: Partial<ThemeShadowTokens>
  /** borderWidth 配置项。 */
  borderWidth?: string
  /** depth 配置项。 */
  depth?: 0 | 1
  /** noise 配置项。 */
  noise?: 0 | 1
}

/** ThemeAlgorithm 类型。 */
export type ThemeAlgorithm = (token: ThemeDesignToken) => ThemeDesignToken

/** ThemeConfig 配置对象。 */
export interface ThemeConfig {
  /** theme 配置项。 */
  theme?: string
  /** token 配置项。 */
  token?: ThemeTokenOverride
  /** algorithm 配置项。 */
  algorithm?: ThemeAlgorithm | readonly ThemeAlgorithm[]
  /** baseToken 配置项。 */
  baseToken?: ThemeDesignToken
}

/** ThemeTokenRuntime 接口。 */
export interface ThemeTokenRuntime {
  /** theme 配置项。 */
  theme: string
  /** resolvedTheme 配置项。 */
  resolvedTheme?: string
  /** token 配置项。 */
  token: ThemeDesignToken
  /** cssVariables 配置项。 */
  cssVariables: ThemeStyleRecord
}

/** ThemeProviderProps 组件属性。 */
export interface ThemeProviderProps extends ThemeConfig {
  /** 自定义渲染的宿主元素。 */
  as?: ThemeProviderTag
  /** 根节点附加类名。 */
  className?: string
  /** render 配置项。 */
  render?: (scope: ThemeTokenRuntime) => any
  /** 根节点内联样式。 */
  style?: ThemeStyleRecord | string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** ThemeControllerProps 组件属性。 */
export interface ThemeControllerProps {
  /** 组件类型或语义类型。 */
  type?: ThemeInputType
  /** 根节点附加类名。 */
  className?: string
  /** theme 配置项。 */
  theme?: string
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

const defaultSeed: ThemeDesignToken = {
  themeName: 'default',
  resolvedThemeName: undefined,
  appearance: 'light',
  density: 'default',
  colorScheme: 'light',
  colors: {
    primary: '#2563eb',
    primaryContent: '#eff6ff',
    secondary: '#0f766e',
    secondaryContent: '#ecfeff',
    accent: '#9333ea',
    accentContent: '#faf5ff',
    neutral: '#0f172a',
    neutralContent: '#f8fafc',
    base100: '#f8fafc',
    base200: '#eef2ff',
    base300: '#e2e8f0',
    baseContent: '#0f172a',
    info: '#0ea5e9',
    infoContent: '#082f49',
    success: '#16a34a',
    successContent: '#f0fdf4',
    warning: '#d97706',
    warningContent: '#451a03',
    error: '#dc2626',
    errorContent: '#fef2f2',
  },
  radius: {
    selector: '0.5rem',
    field: '0.9rem',
    box: '1.4rem',
  },
  size: {
    selector: '0.25rem',
    field: '0.25rem',
  },
  spacing: {
    xs: '0.375rem',
    sm: '0.625rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  typography: {
    family: 'ui-sans-serif, system-ui, sans-serif',
    monoFamily: 'ui-monospace, SFMono-Regular, monospace',
    size: '1rem',
    lineHeight: '1.5',
  },
  shadow: {
    sm: '0 12px 30px rgba(15, 23, 42, 0.08)',
    md: '0 20px 50px rgba(15, 23, 42, 0.12)',
    lg: '0 30px 70px rgba(15, 23, 42, 0.18)',
  },
  borderWidth: '1px',
  depth: 1,
  noise: 0,
}

const themePresets: Readonly<Record<string, ThemeTokenOverride>> = {
  default: {},
  garden: {
    colors: {
      primary: '#2f855a',
      primaryContent: '#f0fff4',
      secondary: '#276749',
      secondaryContent: '#f0fff4',
      accent: '#2b6cb0',
      accentContent: '#eff6ff',
      base100: '#f6fff8',
      base200: '#e6ffed',
      base300: '#c6f6d5',
      baseContent: '#16351f',
      neutral: '#1f2d22',
      neutralContent: '#f7fff8',
      info: '#3182ce',
      success: '#2f855a',
      warning: '#b7791f',
      error: '#c53030',
    },
  },
  retro: {
    colors: {
      primary: '#7b4f2a',
      primaryContent: '#fff7ed',
      secondary: '#5b6c8c',
      secondaryContent: '#eff6ff',
      accent: '#c05621',
      accentContent: '#fff7ed',
      base100: '#fff9ed',
      base200: '#f7ead5',
      base300: '#e9d8b4',
      baseContent: '#3f2c1f',
      neutral: '#6b4f3a',
      neutralContent: '#fff7ed',
      info: '#3b82f6',
      success: '#15803d',
      warning: '#b45309',
      error: '#b91c1c',
    },
  },
  synthwave: {
    appearance: 'dark',
    colorScheme: 'dark',
    colors: {
      primary: '#e779c1',
      primaryContent: '#16081b',
      secondary: '#58c7f3',
      secondaryContent: '#04131d',
      accent: '#f3cc30',
      accentContent: '#241a02',
      base100: '#221551',
      base200: '#1a103d',
      base300: '#140b32',
      baseContent: '#f7f0ff',
      neutral: '#0f0b1f',
      neutralContent: '#f7f0ff',
      info: '#7dd3fc',
      success: '#4ade80',
      warning: '#facc15',
      error: '#fb7185',
    },
    shadow: {
      sm: '0 12px 30px rgba(20, 11, 50, 0.35)',
      md: '0 20px 50px rgba(20, 11, 50, 0.45)',
      lg: '0 30px 80px rgba(20, 11, 50, 0.55)',
    },
  },
  cyberpunk: {
    appearance: 'dark',
    colorScheme: 'dark',
    colors: {
      primary: '#ffed00',
      primaryContent: '#221a00',
      secondary: '#ff7598',
      secondaryContent: '#2f0513',
      accent: '#75d1f0',
      accentContent: '#04141c',
      base100: '#0d0d0d',
      base200: '#171717',
      base300: '#222222',
      baseContent: '#fff9d5',
      neutral: '#050505',
      neutralContent: '#fff9d5',
      info: '#38bdf8',
      success: '#4ade80',
      warning: '#facc15',
      error: '#fb7185',
    },
  },
  night: {
    appearance: 'dark',
    colorScheme: 'dark',
    colors: {
      primary: '#60a5fa',
      primaryContent: '#07111f',
      secondary: '#22d3ee',
      secondaryContent: '#04161a',
      accent: '#c084fc',
      accentContent: '#160a2a',
      base100: '#0f172a',
      base200: '#111c34',
      base300: '#1e293b',
      baseContent: '#e2e8f0',
      neutral: '#020617',
      neutralContent: '#f8fafc',
      info: '#38bdf8',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
    },
    shadow: {
      sm: '0 14px 34px rgba(2, 6, 23, 0.32)',
      md: '0 22px 60px rgba(2, 6, 23, 0.42)',
      lg: '0 36px 90px rgba(2, 6, 23, 0.55)',
    },
  },
  coffee: {
    appearance: 'dark',
    colorScheme: 'dark',
    colors: {
      primary: '#c08457',
      primaryContent: '#2a1409',
      secondary: '#f5d0a9',
      secondaryContent: '#2a1409',
      accent: '#eab308',
      accentContent: '#271605',
      base100: '#21130f',
      base200: '#2e1d17',
      base300: '#3b261d',
      baseContent: '#f7e7db',
      neutral: '#160d0a',
      neutralContent: '#fff7f2',
      info: '#7dd3fc',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#fb7185',
    },
  },
}

const defaultConfig: ThemeConfig = {
  theme: 'default',
}

/** clone Theme Token 的内部工具函数。 */
const cloneThemeToken = (token: ThemeDesignToken): ThemeDesignToken => {
  return {
    ...token,
    colors: { ...token.colors },
    radius: { ...token.radius },
    size: { ...token.size },
    spacing: { ...token.spacing },
    typography: { ...token.typography },
    shadow: { ...token.shadow },
  }
}

/** merge Theme Token 的内部工具函数。 */
const mergeThemeToken = (
  baseToken: ThemeDesignToken,
  override?: ThemeTokenOverride,
): ThemeDesignToken => {
  const nextToken = cloneThemeToken(baseToken)
  if (!override) return nextToken

  if (override.appearance) nextToken.appearance = override.appearance
  if (override.density) nextToken.density = override.density
  if (override.colorScheme) nextToken.colorScheme = override.colorScheme
  if (override.colors) nextToken.colors = { ...nextToken.colors, ...override.colors }
  if (override.radius) nextToken.radius = { ...nextToken.radius, ...override.radius }
  if (override.size) nextToken.size = { ...nextToken.size, ...override.size }
  if (override.spacing) nextToken.spacing = { ...nextToken.spacing, ...override.spacing }
  if (override.typography)
    nextToken.typography = { ...nextToken.typography, ...override.typography }
  if (override.shadow) nextToken.shadow = { ...nextToken.shadow, ...override.shadow }
  if (override.borderWidth) nextToken.borderWidth = override.borderWidth
  if (override.depth !== undefined) nextToken.depth = override.depth
  if (override.noise !== undefined) nextToken.noise = override.noise

  return nextToken
}

/** 归一化 Algorithm List 的内部工具函数。 */
const normalizeAlgorithmList = (algorithm?: ThemeConfig['algorithm']) => {
  if (!algorithm) return []
  return Array.isArray(algorithm) ? [...algorithm] : [algorithm]
}

/** 解析 Theme Name 的内部工具函数。 */
const resolveThemeName = (config?: ThemeConfig) => {
  if (config?.theme) return config.theme
  if (config?.baseToken?.themeName) return config.baseToken.themeName
  return defaultConfig.theme ?? 'default'
}

/** 构建 Preset Token 的内部工具函数。 */
const buildPresetToken = (themeName: string) => {
  const baseToken = cloneThemeToken(defaultSeed)
  const preset = themePresets[themeName]
  const mergedToken = preset ? mergeThemeToken(baseToken, preset) : baseToken
  mergedToken.themeName = themeName
  return mergedToken
}

/** default Algorithm 的内部工具函数。 */
const defaultAlgorithm: ThemeAlgorithm = inputToken => {
  const nextToken = cloneThemeToken(inputToken)
  nextToken.colorScheme = nextToken.appearance
  nextToken.resolvedThemeName = nextToken.themeName === 'default' ? undefined : nextToken.themeName
  return nextToken
}

/** dark Algorithm 的内部工具函数。 */
const darkAlgorithm: ThemeAlgorithm = inputToken => {
  const nextToken = cloneThemeToken(inputToken)
  nextToken.appearance = 'dark'
  nextToken.colorScheme = 'dark'
  nextToken.colors = {
    ...nextToken.colors,
    base100: '#111827',
    base200: '#172036',
    base300: '#243047',
    baseContent: '#f8fafc',
    neutral: '#020617',
    neutralContent: '#f8fafc',
    infoContent: '#082f49',
    successContent: '#052e16',
    warningContent: '#451a03',
    errorContent: '#450a0a',
  }
  nextToken.shadow = {
    sm: '0 14px 34px rgba(2, 6, 23, 0.32)',
    md: '0 24px 64px rgba(2, 6, 23, 0.42)',
    lg: '0 36px 96px rgba(2, 6, 23, 0.54)',
  }
  return nextToken
}

/** compact Algorithm 的内部工具函数。 */
const compactAlgorithm: ThemeAlgorithm = inputToken => {
  const nextToken = cloneThemeToken(inputToken)
  nextToken.density = 'compact'
  nextToken.radius = {
    selector: '0.375rem',
    field: '0.75rem',
    box: '1rem',
  }
  nextToken.size = {
    selector: '0.21875rem',
    field: '0.21875rem',
  }
  nextToken.spacing = {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  }
  nextToken.typography = {
    ...nextToken.typography,
    size: '0.95rem',
  }
  return nextToken
}

/** 读取 Design Token 的内部工具函数。 */
const getDesignToken = (config?: ThemeConfig) => {
  const themeName = resolveThemeName(config)
  const baseToken = config?.baseToken
    ? cloneThemeToken(config.baseToken)
    : buildPresetToken(themeName)
  baseToken.themeName = themeName

  const algorithmList = normalizeAlgorithmList(config?.algorithm)
  const derivedToken = algorithmList.reduce(
    (currentToken, algorithm) => algorithm(currentToken),
    baseToken,
  )
  const mergedToken = mergeThemeToken(derivedToken, config?.token)

  return defaultAlgorithm(mergedToken)
}

/** 创建 Css Variables 的内部工具函数。 */
const createCssVariables = (token: ThemeDesignToken): ThemeStyleRecord => {
  return {
    '--color-primary': token.colors.primary,
    '--color-primary-content': token.colors.primaryContent,
    '--color-secondary': token.colors.secondary,
    '--color-secondary-content': token.colors.secondaryContent,
    '--color-accent': token.colors.accent,
    '--color-accent-content': token.colors.accentContent,
    '--color-neutral': token.colors.neutral,
    '--color-neutral-content': token.colors.neutralContent,
    '--color-base-100': token.colors.base100,
    '--color-base-200': token.colors.base200,
    '--color-base-300': token.colors.base300,
    '--color-base-content': token.colors.baseContent,
    '--color-info': token.colors.info,
    '--color-info-content': token.colors.infoContent,
    '--color-success': token.colors.success,
    '--color-success-content': token.colors.successContent,
    '--color-warning': token.colors.warning,
    '--color-warning-content': token.colors.warningContent,
    '--color-error': token.colors.error,
    '--color-error-content': token.colors.errorContent,
    '--radius-selector': token.radius.selector,
    '--radius-field': token.radius.field,
    '--radius-box': token.radius.box,
    '--size-selector': token.size.selector,
    '--size-field': token.size.field,
    '--border': token.borderWidth,
    '--depth': String(token.depth),
    '--noise': String(token.noise),
    '--rue-theme-space-xs': token.spacing.xs,
    '--rue-theme-space-sm': token.spacing.sm,
    '--rue-theme-space-md': token.spacing.md,
    '--rue-theme-space-lg': token.spacing.lg,
    '--rue-theme-space-xl': token.spacing.xl,
    '--rue-theme-font-family': token.typography.family,
    '--rue-theme-font-mono': token.typography.monoFamily,
    '--rue-theme-font-size': token.typography.size,
    '--rue-theme-line-height': token.typography.lineHeight,
    '--rue-theme-shadow-sm': token.shadow.sm,
    '--rue-theme-shadow-md': token.shadow.md,
    '--rue-theme-shadow-lg': token.shadow.lg,
  }
}

/** use Token 的内部工具函数。 */
const useToken = (config?: ThemeConfig): ThemeTokenRuntime => {
  const token = getDesignToken(config)
  return {
    theme: token.themeName,
    resolvedTheme: token.resolvedThemeName,
    token,
    cssVariables: createCssVariables(token),
  }
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/** assign Forwarded Ref 的内部工具函数。 */
const assignForwardedRef = (forwardedRef: any, element: HTMLElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

/** 转换为 Kebab Case 的内部工具函数。 */
const toKebabCase = (property: string) => {
  if (property.startsWith('--')) return property
  return property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

/** serialize Style Record 的内部工具函数。 */
const serializeStyleRecord = (style: ThemeStyleRecord) => {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)}`)
    .join('; ')
}

/** merge Style Input 的内部工具函数。 */
const mergeStyleInput = (baseStyle: ThemeStyleRecord, extraStyle?: ThemeStyleRecord | string) => {
  const serializedBaseStyle = serializeStyleRecord(baseStyle)
  if (!extraStyle) return serializedBaseStyle
  if (typeof extraStyle === 'string') {
    return serializedBaseStyle ? `${serializedBaseStyle}; ${extraStyle}` : extraStyle
  }
  const serializedExtraStyle = serializeStyleRecord(extraStyle)
  if (!serializedBaseStyle) return serializedExtraStyle
  if (!serializedExtraStyle) return serializedBaseStyle
  return `${serializedBaseStyle}; ${serializedExtraStyle}`
}

/** 主题控制输入：继续映射到 daisyUI 的 theme-controller 类。 */
const ThemeInput: FC<ThemeControllerProps> = ({ type = 'checkbox', theme, className, ...rest }) => {
  const resolvedValue = theme ?? rest.value
  const cls = mergeClassName('theme-controller', className)
  return (
    <input
      {...rest}
      type={type}
      value={resolvedValue}
      autoComplete={rest.autoComplete ?? 'off'}
      className={cls}
    />
  )
}

/** 作用域主题容器：通过 data-theme 与 CSS 变量把 token 限定在当前子树。 */
const ThemeProvider: FC<ThemeProviderProps> = ({
  as = 'div',
  className,
  render,
  style,
  children,
  theme,
  token,
  algorithm,
  baseToken,
  ref: forwardedRef,
  ...rest
}) => {
  const runtime = useToken({
    theme,
    token,
    algorithm,
    baseToken,
  })
  const content = render ? render(runtime) : children
  const mergedStyle = mergeStyleInput(
    {
      colorScheme: runtime.token.colorScheme,
      color: runtime.token.colors.baseContent,
      ...runtime.cssVariables,
    },
    style,
  )
  const applyRef = (element: HTMLElement | null) => {
    assignForwardedRef(forwardedRef, element)
  }

  const commonProps = {
    ...rest,
    ref: applyRef,
    className: mergeClassName('rue-theme-scope', className),
    style: mergedStyle,
    'data-theme': runtime.resolvedTheme,
    'data-rue-theme': runtime.theme,
    'data-rue-appearance': runtime.token.appearance,
    'data-rue-density': runtime.token.density,
  }

  if (as === 'section') {
    return <section {...commonProps}>{content}</section>
  }
  if (as === 'article') {
    return <article {...commonProps}>{content}</article>
  }
  if (as === 'span') {
    return <span {...commonProps}>{content}</span>
  }

  return <div {...commonProps}>{content}</div>
}

type ThemeControllerCompound = FC<ThemeControllerProps> & {
  Provider: FC<ThemeProviderProps>
  compactAlgorithm: ThemeAlgorithm
  darkAlgorithm: ThemeAlgorithm
  defaultAlgorithm: ThemeAlgorithm
  defaultConfig: ThemeConfig
  defaultSeed: ThemeDesignToken
  getDesignToken: (config?: ThemeConfig) => ThemeDesignToken
  presets: Readonly<Record<string, ThemeTokenOverride>>
  useToken: (config?: ThemeConfig) => ThemeTokenRuntime
}

const ThemeController: ThemeControllerCompound = Object.assign(ThemeInput, {
  Provider: ThemeProvider,
  compactAlgorithm,
  darkAlgorithm,
  defaultAlgorithm,
  defaultConfig,
  defaultSeed,
  getDesignToken,
  presets: themePresets,
  useToken,
})

/** 默认导出主题组件。 */
export default ThemeController
