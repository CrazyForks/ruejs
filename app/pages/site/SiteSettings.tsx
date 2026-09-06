import { type FC, useState, watch } from '@rue-js/rue'
import { useI18n } from '@rue-js/i18n'
import {
  applyBrowserTheme,
  readStoredTheme,
  resolveTheme,
  type SiteTheme,
  themes,
} from './themePreferences'

const SiteSettings: FC = () => {
  const { _ } = useI18n()
  const [theme, setTheme] = useState<SiteTheme>(() => readStoredTheme())

  watch(
    () => theme,
    nextTheme => {
      applyBrowserTheme(nextTheme)
    },
    { immediate: true },
  )

  const labels: Record<SiteTheme, string> = {
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
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Rue Site</p>
        <h1 className="text-4xl font-bold tracking-tight">{_('站点设置')}</h1>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{_('主题')}</h2>
          <p className="mt-2 text-sm text-base-content/65">
            {_('主题偏好会保存在当前浏览器。静态页面默认使用 luxury 主题。')}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            aria-label={_('切换主题')}
            className="select select-bordered w-full sm:w-72"
            value={theme}
            onChange={(event: Event) => {
              setTheme(resolveTheme((event.currentTarget as HTMLSelectElement).value))
            }}
          >
            {themes.map(name => (
              <option key={name} value={name}>
                {labels[name]} ({name})
              </option>
            ))}
          </select>
          <span className="badge badge-neutral badge-lg">{theme}</span>
        </div>
      </section>

      <section className="space-y-4 border-t border-base-300 pt-8">
        <div>
          <h2 className="text-xl font-semibold">{_('语言')}</h2>
          <p className="mt-2 text-sm text-base-content/65">
            {_('当前站点固定为中文；后续语言版本会拆成独立站点。')}
          </p>
        </div>
        <div className="badge badge-outline badge-lg">zh-CN</div>
      </section>
    </div>
  )
}

export default SiteSettings
