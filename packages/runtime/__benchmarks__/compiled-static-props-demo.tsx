import { onCleanup, setReactiveScheduling, signal } from '@rue-js/rue/internal'
import { ref } from '@rue-js/rue'

export const trace = {
  safeSetups: 0,
  safeCleanups: 0,
  clicks: [] as string[],
}

type SafeProps = {
  label: string
  tone: string
  optional?: string
  onClick: () => void
}

export const SafeCard = (props: SafeProps) => {
  trace.safeSetups += 1
  onCleanup(() => {
    trace.safeCleanups += 1
  })
  const local = signal(0)
  return (
    <button
      className={props.tone}
      data-local={local.get()}
      data-optional={props.optional}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

export const EarlyReturn = (props: { label: string }) => {
  const enabled = ref(true)
  if (enabled.value) return <div>{props.label}</div>
  return <span>{props.label}</span>
}

export const SpreadProps = (props: Record<string, unknown>) => <div {...props} />

const demoProps = signal<SafeProps>({
  label: 'one',
  tone: 'tone-one',
  optional: 'present',
  onClick: () => trace.clicks.push('one'),
})

export const setDemoScheduling = () => setReactiveScheduling('sync')

export const updateDemo = (
  label: string,
  tone: string,
  optional: string | undefined,
  clickLabel: string,
) => {
  demoProps.set({
    label,
    tone,
    optional,
    onClick: () => trace.clicks.push(clickLabel),
  })
}

export const DemoParent = () => (
  <main>
    <SafeCard
      label={demoProps.get().label}
      tone={demoProps.get().tone}
      optional={demoProps.get().optional}
      onClick={demoProps.get().onClick}
    />
  </main>
)
