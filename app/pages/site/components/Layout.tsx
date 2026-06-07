import { type FC, useComponent, useState, watch } from '@rue-js/rue'
import { useI18n } from '@rue-js/i18n'
import { RouterLink } from '@rue-js/router'
import { resolveLocale } from '../../../i18n'

const DocSearchBox = useComponent(() => import('../DocSearchBox'))

const DEFAULT_THEME = 'luxury'

const themes = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
] as const

const resolveTheme = (value: string | null) => {
  if (value && themes.includes(value as (typeof themes)[number])) {
    return value
  }

  return DEFAULT_THEME
}

const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
] as const

const ThemePicker: FC = () => {
  const { _ } = useI18n()
  const [theme, setTheme] = useState<string>(() => {
    return resolveTheme(localStorage.getItem('rue.theme'))
  })

  const syncTheme = () => {
    localStorage.setItem('rue.theme', theme.value)
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  watch(() => theme.value, syncTheme, { immediate: true })

  const labels: Record<string, string> = {
    light: _('亮色'),
    dark: _('暗色'),
    cupcake: _('纸杯蛋糕'),
    bumblebee: _('大黄蜂'),
    emerald: _('祖母绿'),
    corporate: _('企业'),
    synthwave: _('合成波'),
    retro: _('复古'),
    cyberpunk: _('赛博朋克'),
    valentine: _('情人节'),
    halloween: _('万圣节'),
    garden: _('花园'),
    forest: _('森林'),
    aqua: _('海洋蓝'),
    lofi: _('低保真'),
    pastel: _('粉彩'),
    fantasy: _('奇幻'),
    wireframe: _('线框'),
    black: _('黑色'),
    luxury: _('奢华'),
    dracula: _('德古拉'),
    cmyk: _('CMYK'),
    autumn: _('秋天'),
    business: _('商务'),
    acid: _('酸性'),
    lemonade: _('柠檬水'),
    night: _('夜间'),
    coffee: _('咖啡'),
    winter: _('冬季'),
    dim: _('昏暗'),
    nord: _('北欧'),
    sunset: _('日落'),
  }
  return (
    <>
      <select
        aria-label={_('切换主题')}
        className="select select-bordered select-sm bg-transparent"
        value={theme.value}
        onChange={(e: Event) => {
          const nextTheme = resolveTheme((e.currentTarget as HTMLSelectElement).value)
          setTheme(nextTheme)
          localStorage.setItem('rue.theme', nextTheme)
          document.documentElement.setAttribute('data-theme', nextTheme)
        }}
      >
        {themes.map(name => (
          <option key={name} value={name}>
            {labels[name] ? `${labels[name]} (${name})` : name}
          </option>
        ))}
      </select>
    </>
  )
}

const LanguagePicker: FC = () => {
  const { _, locale, setLocale } = useI18n()

  const syncLocale = () => {
    if (typeof window === 'undefined') {
      return
    }

    const nextLocale = resolveLocale(locale.value)
    window.localStorage.setItem('rue.locale', nextLocale)
    document.documentElement.setAttribute('lang', nextLocale)
  }

  watch(() => locale.value, syncLocale, { immediate: true })

  return (
    <select
      aria-label={_('切换语言')}
      className="select select-bordered select-sm w-28 md:w-32 bg-transparent"
      value={locale.value}
      onChange={(e: Event) => {
        setLocale(resolveLocale((e.currentTarget as HTMLSelectElement).value))
      }}
    >
      {localeOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

const Header: FC = () => {
  const { _ } = useI18n()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <header className="site-header fixed top-0 left-0 right-0 z-50 w-full">
      <div className="navbar bg-transparent max-w-[1400px] mx-auto w-full px-6 items-center">
        <div className="navbar-start gap-4">
          <RouterLink to="/" className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg ring-1 ring-white/30">
              <span className="text-white font-extrabold text-[32px] md:text-[50px]">R</span>
            </span>
            <span className="text-lg md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              {_('后悔药 Rue.js')}
            </span>
          </RouterLink>
          <DocSearchBox />
        </div>
        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal px-1 text-sm">
            <li>
              <RouterLink to="/" className="btn btn-ghost btn-sm">
                {_('首页')}
              </RouterLink>
            </li>
            <li
              className={`dropdown relative ${open.value === 'docs' ? 'dropdown-open' : ''}`}
              onMouseEnter={() => setOpen('docs')}
              onMouseLeave={() => setOpen(null)}
            >
              <a className="btn btn-ghost btn-sm">{_('文档')}</a>
              <ul
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-35 p-2 shadow dropdown-panel top-full left-1/2 -translate-x-1/2 text-center"
                onMouseLeave={() => setOpen(null)}
              >
                <li>
                  <RouterLink to="/guide/guide/introduction" onMouseDown={() => setOpen(null)}>
                    {_('深度指南')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/examples/hello-world" onMouseDown={() => setOpen(null)}>
                    {_('实战例子')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/guide/guide/quick-start" onMouseDown={() => setOpen(null)}>
                    {_('快速上手')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/routing" onMouseDown={() => setOpen(null)}>
                    {_('路由指南')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/glossary/index" onMouseDown={() => setOpen(null)}>
                    {_('术语表')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/error-reference/index" onMouseDown={() => setOpen(null)}>
                    {_('错误代码参考')}
                  </RouterLink>
                </li>
              </ul>
            </li>
            <li>
              <RouterLink to="/api/api/index" className="btn btn-ghost btn-sm">
                API
              </RouterLink>
            </li>
            <li
              className={`dropdown relative ${open.value === 'ecosystem' ? 'dropdown-open' : ''}`}
              onMouseEnter={() => setOpen('ecosystem')}
              onMouseLeave={() => setOpen(null)}
            >
              <a className="btn btn-ghost btn-sm">{_('生态')}</a>
              <ul
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-35 p-2 shadow dropdown-panel top-full left-1/2 -translate-x-1/2 text-center"
                onMouseLeave={() => setOpen(null)}
              >
                <li>
                  <RouterLink to="/page/partners/index" onMouseDown={() => setOpen(null)}>
                    {_('合作伙伴')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/plugins" onMouseDown={() => setOpen(null)}>
                    {_('插件')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/design/button" onMouseDown={() => setOpen(null)}>
                    {_('组件库')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/guide/scaling-up/tooling" onMouseDown={() => setOpen(null)}>
                    {_('工具链')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/textjs" onMouseDown={() => setOpen(null)}>
                    Text.js
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/ecosystem/newsletters" onMouseDown={() => setOpen(null)}>
                    {_('新闻简报')}
                  </RouterLink>
                </li>
              </ul>
            </li>
            <li
              className={`dropdown relative ${open.value === 'about' ? 'dropdown-open' : ''}`}
              onMouseEnter={() => setOpen('about')}
              onMouseLeave={() => setOpen(null)}
            >
              <a className="btn btn-ghost btn-sm">{_('关于')}</a>
              <ul
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-35 p-2 shadow dropdown-panel top-full left-1/2 -translate-x-1/2 text-center"
                onMouseLeave={() => setOpen(null)}
              >
                <li>
                  <RouterLink to="/page/about/faq" onMouseDown={() => setOpen(null)}>
                    {_('常见问题')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/about/team" onMouseDown={() => setOpen(null)}>
                    {_('团队')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/about/releases" onMouseDown={() => setOpen(null)}>
                    {_('版本发布')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/about/community-guide" onMouseDown={() => setOpen(null)}>
                    {_('社区指南')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/about/coc" onMouseDown={() => setOpen(null)}>
                    {_('行为规范')}
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/page/about/privacy" onMouseDown={() => setOpen(null)}>
                    {_('隐私政策')}
                  </RouterLink>
                </li>
              </ul>
            </li>
            <li>
              <RouterLink to="/page/sponsor/index" className="btn btn-ghost btn-sm">
                {_('赞助')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/partners/index" className="btn btn-ghost btn-sm">
                {_('合作伙伴')}
              </RouterLink>
            </li>
          </ul>
        </div>
        <div className="navbar-end gap-2 items-center">
          <LanguagePicker />
          <div className="hidden md:block">
            <ThemePicker />
          </div>
        </div>
      </div>
    </header>
  )
}

const Footer: FC = () => {
  const { _ } = useI18n()

  return (
    <footer className="w-full bg-base-200 overflow-hidden">
      <div className="max-w-[1100px] mx-auto w-full px-6 py-12 grid gap-8 grid-cols-1 md:grid-cols-3">
        <div>
          <div className="text-base-content font-semibold mb-2">{_('文档')}</div>
          <ul className="space-y-2 text-sm">
            <li>
              <RouterLink to="/jsx/basic-elements" className="hover:underline">
                {_('深度指南')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/examples/hello-world" className="hover:underline">
                {_('实战例子')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/guide/guide/quick-start" className="hover:underline">
                {_('快速上手')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/glossary/index" className="hover:underline">
                {_('术语表')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/error-reference/index" className="hover:underline">
                {_('错误码参照表')}
              </RouterLink>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-base-content font-semibold mb-2">{_('关于')}</div>
          <ul className="space-y-2 text-sm">
            <li>
              <RouterLink to="/page/about/faq" className="hover:underline">
                {_('常见问题')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/about/team" className="hover:underline">
                {_('团队')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/about/releases" className="hover:underline">
                {_('版本发布')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/about/community-guide" className="hover:underline">
                {_('社区指南')}
              </RouterLink>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-base-content font-semibold mb-2">{_('生态')}</div>
          <ul className="space-y-2 text-sm">
            <li>
              <RouterLink to="/plugins" className="hover:underline">
                {_('插件')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/design/button" className="hover:underline">
                {_('组件库')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/page/routing" className="hover:underline">
                {_('路由指南')}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/textjs" className="hover:underline">
                Text.js
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center text-xs text-base-content/60 pb-8">
          © 2024-{new Date().getFullYear()} Xiangmin Liu
        </div>
      </div>
      <div className="mx-auto w-full px-6 pb-4 text-center">
        <div className="flex select-none items-end justify-center gap-6 whitespace-nowrap text-[clamp(12rem,28vw,26rem)] font-black leading-none bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent md:gap-10">
          <span>Rue</span>
          <span className="pl-1">.JS</span>
        </div>
      </div>
    </footer>
  )
}

const SiteLayout: FC<{ title?: string }> = props => {
  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <Header />
      <main className="min-h-[60vh] pt-24">
        <div className="max-w-[1400px] mx-auto px-6 py-10">{props.children}</div>
      </main>
      <Footer />
    </div>
  )
}

export default SiteLayout
