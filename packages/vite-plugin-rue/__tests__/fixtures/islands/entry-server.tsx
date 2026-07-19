import { type FC } from '@rue-js/rue'
import { createIslandContainerHtml, type RueIslandManifestEntry } from '@rue-js/rue/island'
import { renderToString } from '@rue-js/server-renderer'
import { manifest } from 'virtual:rue-island-manifest'
import Counter from './components/Counter'
import OnlyPanel from './components/OnlyPanel'

const StaticPage: FC = () => <main data-page="static">static fixture</main>
const LoadPage: FC = () => <Counter client:load label="load server" />
const OnlyPage: FC = () => (
  <OnlyPanel client:only label="only client" fallback={<p data-only-fallback>only fallback</p>} />
)

// This component is intentionally not rendered. The real plugin still indexes it and creates
// the idle Counter importer used by the nested-island page below.
export const NestedRegistrySeed: FC = () => <Counter client:idle label="nested seed" />

const findEntry = (hydrate: RueIslandManifestEntry['hydrate']) => {
  const match = Object.entries(manifest).find(
    ([, entry]) => entry.exportName === 'default' && entry.hydrate === hydrate,
  )
  if (!match) throw new Error(`Missing ${hydrate} fixture island manifest entry.`)
  return { id: match[0], entry: match[1] }
}

const renderNestedPage = () => {
  const outer = findEntry('load')
  const inner = findEntry('idle')
  const innerHtml = createIslandContainerHtml({
    id: inner.id,
    component: inner.id,
    entry: inner.id,
    hydrate: 'idle',
    props: { label: 'inner' },
    html: '<span data-nested-server="inner">inner server</span>',
  })
  return createIslandContainerHtml({
    id: outer.id,
    component: outer.id,
    entry: outer.id,
    hydrate: 'load',
    props: { label: 'outer' },
    html: `<div data-nested-server="outer">outer server${innerHtml}</div>`,
  })
}

export const renderFixturePage = async (route: 'static' | 'load' | 'only' | 'nested') => {
  if (route === 'static') return renderToString(StaticPage)
  if (route === 'load') return renderToString(LoadPage)
  if (route === 'only') return renderToString(OnlyPage)
  return renderNestedPage()
}

export { manifest }
