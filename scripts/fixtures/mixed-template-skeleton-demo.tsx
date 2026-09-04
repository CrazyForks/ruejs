import { Slot, Template, onBeforeUnmount, ref, render } from '@rue-js/rue'
import {
  onCleanup,
  setReactiveScheduling as setCompiledScheduling,
  signal as compiledSignal,
} from '@rue-js/rue/internal'

type DemoState = {
  label: string
  show: boolean
  tone: string
  spread: Record<string, string>
}

export const trace = {
  clicks: [] as string[],
  refs: [] as Array<Element | null>,
  compiledSetups: 0,
  compiledCleanups: 0,
  panelSetups: 0,
  panelCleanups: 0,
  defaultSlotCalls: 0,
  asideSlotCalls: 0,
}

const state = ref<DemoState>({
  label: 'one',
  show: true,
  tone: 'tone-one',
  spread: { 'data-spread': 'one', title: 'spread-one' },
})

const compiledState = compiledSignal({
  label: 'one',
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
})

const fallbackRef = ref<Element | null>(null)

const CompiledBadge = (props: { label: string }) => {
  trace.compiledSetups += 1
  onCleanup(() => {
    trace.compiledCleanups += 1
  })
  return <strong data-compiled="">compiled:{props.label}</strong>
}

const Panel = (props: Record<string, unknown>) => {
  trace.panelSetups += 1
  onBeforeUnmount(() => {
    trace.panelCleanups += 1
  })
  return (
    <article data-panel="">
      <header data-panel-aside="">
        <Slot source={props} name="aside" />
      </header>
      <div data-panel-default="">
        <Slot source={props} />
      </div>
    </article>
  )
}

export const setDemoScheduling = () => {
  setCompiledScheduling('sync')
}

export const updateDemo = (phase: 1 | 2) => {
  state.value =
    phase === 1
      ? {
          label: 'two',
          show: false,
          tone: 'tone-two',
          spread: { 'data-spread': 'two', title: 'spread-two' },
        }
      : {
          label: 'three',
          show: true,
          tone: 'tone-three',
          spread: { 'data-spread': 'three', title: 'spread-three' },
        }
  compiledState.set(
    phase === 1
      ? {
          label: 'two',
          items: [
            { id: 'b', label: 'B2' },
            { id: 'a', label: 'A2' },
          ],
        }
      : {
          label: 'three',
          items: [
            { id: 'a', label: 'A3' },
            { id: 'c', label: 'C3' },
          ],
        },
  )
}

export const DemoParent = () => (
  <main
    data-root=""
    data-before="fixed"
    className={state.value.tone}
    {...state.value.spread}
    title="after-spread"
    ref={value => {
      fallbackRef.value = value
      trace.refs.push(value)
    }}
  >
    <header data-static="title">
      <h1>Mixed template skeleton</h1>
      <p data-label="">label:{state.value.label}</p>
    </header>
    <button data-action="" onClick={() => trace.clicks.push(state.value.label)}>
      record
    </button>
    <section data-static="before">before</section>
    {state.value.show ? <span data-condition="">shown:{state.value.label}</span> : null}
    <ul data-list="">
      {compiledState.get().items.map(item => (
        <li key={item.id} data-row={item.id}>
          {item.label}
        </li>
      ))}
    </ul>
    <CompiledBadge label={compiledState.get().label} />
    <Panel>
      {() => {
        trace.defaultSlotCalls += 1
        return <div data-default-slot="">default:{state.value.label}</div>
      }}
      <Template slot="aside">
        {() => {
          trace.asideSlotCalls += 1
          return <aside data-named-slot="">aside:{state.value.label}</aside>
        }}
      </Template>
    </Panel>
    <footer data-static="after">after</footer>
  </main>
)

export const mountDemo = (host: Element) => render(DemoParent(), host as any)
export const unmountDemo = (host: Element) => render(null, host as any)
