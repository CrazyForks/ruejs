import type { FC } from '@rue-js/rue'
import Code from '../site/components/Code'
import Tabs from '../../../packages/rue-design/src/components/tabs/index'

export type PreviewTabMode = 'preview' | 'code'

interface PreviewBlockProps {
  title: string
  summary?: string
  tab: { value: PreviewTabMode }
  preview: (() => any) | any
  code: string
}

const PreviewRenderer: FC<{ preview: PreviewBlockProps['preview'] }> = ({ preview }) => {
  if (typeof preview === 'function') {
    const PreviewComponent = preview as FC
    return <PreviewComponent />
  }

  return preview
}

const PreviewBlock: FC<PreviewBlockProps> = ({ title, summary, tab, preview, code }) => {
  return (
    <div className="component-preview not-prose text-base-content my-6 lg:my-12">
      {summary ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
            <p className="m-0 text-sm opacity-70">{summary}</p>
          </div>
        </div>
      ) : (
        <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
      )}
      <Tabs
        style="box"
        items={[
          { key: 'preview', label: '预览' },
          { key: 'code', label: 'JSX代码' },
        ]}
        activeKey={tab.value}
        onChange={key => (tab.value = key as PreviewTabMode)}
        className={summary ? 'mb-3 mt-4' : 'mb-3'}
      />
      {tab.value === 'preview' ? <PreviewRenderer preview={preview} /> : <Code className="mt-2" lang="tsx" code={code} />}
    </div>
  )
}

export default PreviewBlock
