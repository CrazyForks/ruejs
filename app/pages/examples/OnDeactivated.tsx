/**
 * onDeactivated 示例页。
 *
 * 展示 KeepAlive 缓存组件离开活动 DOM 区间时的 deactivated 生命周期。
 */
import { Component, KeepAlive, onDeactivated, ref, useState, type FC } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type PanelName = 'EditorPanel' | 'CounterPanel'

type PanelProps = {
  writeLog: (message: string) => void
}

const panelLabels: Record<PanelName, string> = {
  EditorPanel: '编辑器',
  CounterPanel: '计数器',
}

/** 带草稿状态的编辑器面板，停用时写入日志。 */
const EditorPanel: FC<PanelProps> = props => {
  const [text, setText] = useState('切到计数器后再回来，这段文字还在。')

  onDeactivated(() => {
    props.writeLog(`EditorPanel deactivated: "${text.slice(0, 12)}"`)
  })

  return (
    <section className="rounded-box border border-info/25 bg-info/10 p-5">
      <div className="text-xs font-semibold uppercase opacity-60">EditorPanel</div>
      <label className="form-control mt-4">
        <span className="label-text">草稿内容</span>
        <textarea
          className="textarea textarea-bordered mt-2 min-h-28"
          value={text}
          onInput={(event: Event) => {
            setText((event.target as HTMLTextAreaElement).value)
          }}
        />
      </label>
    </section>
  )
}

const CounterPanel: FC<PanelProps> = props => {
  const [count, setCount] = useState(0)

  onDeactivated(() => {
    props.writeLog(`CounterPanel deactivated: count = ${count}`)
  })

  return (
    <section className="rounded-box border border-success/25 bg-success/10 p-5">
      <div className="text-xs font-semibold uppercase opacity-60">CounterPanel</div>
      <div className="mt-4 text-5xl font-semibold">{count}</div>
      <button
        className="btn btn-success btn-sm mt-5"
        onClick={() => {
          setCount(value => value + 1)
        }}
      >
        增加
      </button>
    </section>
  )
}

const panels: Record<PanelName, FC<PanelProps>> = {
  EditorPanel,
  CounterPanel,
}

const demoCode = `import {
  Component,
  KeepAlive,
  onDeactivated,
  ref,
  useState,
  type FC,
} from '@rue-js/rue';

const EditorPanel: FC<{ writeLog: (message: string) => void }> = props => {
  const [text, setText] = useState('draft');

  onDeactivated(() => {
    props.writeLog(\`EditorPanel deactivated: "\${text}"\`);
  });

  return (
    <textarea
      value={text}
      onInput={(event: Event) => {
        setText((event.target as HTMLTextAreaElement).value);
      }}
    />
  );
};

const CounterPanel: FC<{ writeLog: (message: string) => void }> = props => {
  const [count, setCount] = useState(0);

  onDeactivated(() => {
    props.writeLog(\`CounterPanel deactivated: count = \${count}\`);
  });

  return (
    <button onClick={() => setCount(value => value + 1)}>
      count: {count}
    </button>
  );
};

const panels = { EditorPanel, CounterPanel };

/** KeepAlive 切换示例主体，负责在两个缓存面板之间切换并记录日志。 */
const Demo: FC = () => {
  const activePanel = ref<keyof typeof panels>('EditorPanel');

  return (
    <KeepAlive>
      <Component
        is={panels[activePanel.value]}
        key={activePanel.value}
        writeLog={message => console.log(message)}
      />
    </KeepAlive>
  );
};`

const KeepAliveViewport: FC<{
  activePanel: { value: PanelName }
  writeLog: (message: string) => void
}> = props => {
  return (
    <KeepAlive>
      <Component
        is={panels[props.activePanel.value]}
        key={props.activePanel.value}
        writeLog={props.writeLog}
      />
    </KeepAlive>
  )
}

/** onDeactivated 交互示例入口。 */
const OnDeactivated: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const activePanel = ref<PanelName>('EditorPanel')
  const logs = ref<string[]>([])

  const writeLog = (message: string) => {
    logs.value = [`${new Date().toLocaleTimeString()}  ${message}`, ...logs.value].slice(0, 6)
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onDeactivated()</h1>

      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'preview'
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'code'
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab.value === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={demoCode} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-6">
              <div className="join">
                {(Object.keys(panels) as PanelName[]).map(name => (
                  <button
                    className={`btn join-item ${activePanel.value === name ? 'btn-primary' : ''}`}
                    onClick={() => {
                      activePanel.value = name
                    }}
                    key={name}
                  >
                    {panelLabels[name]}
                  </button>
                ))}
              </div>

              <KeepAliveViewport activePanel={activePanel} writeLog={writeLog} />

              <section className="rounded-box bg-base-200 p-4">
                <h2 className="text-lg font-semibold">Deactivated 日志</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {logs.value.length === 0 && (
                    <li className="opacity-60">切换面板后会出现日志。</li>
                  )}
                  {logs.value.map((item, index) => (
                    <li className="rounded-box bg-base-100 px-3 py-2" key={`${item}:${index}`}>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnDeactivated
