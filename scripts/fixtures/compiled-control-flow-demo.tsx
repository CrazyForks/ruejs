import {
  onCleanup,
  setReactiveScheduling as setCompiledScheduling,
  signal as compiledSignal,
} from '@rue-js/rue/internal'
import { ref } from '@rue-js/rue'

export const trace = {
  setups: 0,
  cleanups: 0,
  regionSetups: { entry: 0, middle: 0, final: 0 },
  regionCleanups: { entry: 0, middle: 0, final: 0 },
  regionSetupIds: { entry: [] as number[], middle: [] as number[], final: [] as number[] },
  bumpEntryCompiled: () => {},
  bumpEntryRef: () => {},
  bumpMiddle: () => {},
  bumpFinal: () => {},
}

type RegionName = keyof typeof trace.regionSetups

const beginSetup = (region: RegionName) => {
  const setupId = ++trace.setups
  trace.regionSetups[region] += 1
  trace.regionSetupIds[region].push(setupId)
  onCleanup(() => {
    trace.cleanups += 1
    trace.regionCleanups[region] += 1
  })
  return setupId
}

type BranchProps = {
  label: string
  mode: number
}

export const SafeBranch = (props: BranchProps) => {
  const entryMarker = beginSetup('entry')
  const entryPrefix = 'entry'
  const entrySuffix = 'state'
  const bumpEntryValue = (value: number) => value + 1
  const entryCompiled = compiledSignal(1)
  const entryRef = ref(10)
  trace.bumpEntryCompiled = () => {
    entryCompiled.update(bumpEntryValue)
  }
  trace.bumpEntryRef = () => {
    entryRef.value += 10
  }

  if (props.mode === 0 && entryCompiled.get() === 1 && entryRef.value === 10)
    return (
      <div data-branch="a" data-state="initial">
        A initial · {props.label}
      </div>
    )
  if (props.mode === 0 && entryRef.value === 10)
    return (
      <div data-branch="a" data-state="compiled">
        A compiled · {props.label}
      </div>
    )
  if (props.mode === 0)
    return (
      <div data-branch="a" data-state="changed">
        A changed · {props.label}
      </div>
    )

  const middleMarker = beginSetup('middle')
  const hello = 'hello'
  const middleSuffix = 'region'
  function bumpMiddleValue(value: number) {
    return value + 1
  }
  const middleCompiled = compiledSignal(2)
  const middleRef = ref(20)
  trace.bumpMiddle = () => {
    middleCompiled.update(bumpMiddleValue)
    middleRef.value += 10
  }

  if (props.mode === 1 && middleCompiled.get() === 2 && middleRef.value === 20)
    return (
      <section data-branch="b" data-state="initial">
        B initial · {props.label}
      </section>
    )
  if (props.mode === 1)
    return (
      <section data-branch="b" data-state="changed">
        B changed · {props.label}
      </section>
    )

  const finalMarker = beginSetup('final')
  const world = 'world'
  const finalSuffix = 'region'
  const bumpFinalValue = (value: number) => value + 1
  const finalCompiled = compiledSignal(3)
  const finalRef = ref(30)
  trace.bumpFinal = () => {
    finalCompiled.update(bumpFinalValue)
    finalRef.value += 10
  }

  if (finalCompiled.get() === 3 && finalRef.value === 30)
    return (
      <article data-branch="c" data-state="initial">
        C initial · {props.label}
      </article>
    )
  return (
    <article data-branch="c" data-state="changed">
      C changed · {props.label}
    </article>
  )
}

const state = compiledSignal<BranchProps>({ label: 'one', mode: 0 })

export const setDemoScheduling = () => {
  setCompiledScheduling('sync')
}
export const updateDemo = (mode: number, label: string) => state.set({ mode, label })

export const DemoParent = () => (
  <main>
    <SafeBranch mode={state.get().mode} label={state.get().label} />
  </main>
)
