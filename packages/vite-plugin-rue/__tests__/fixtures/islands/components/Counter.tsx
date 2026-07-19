import { type ComponentProps, type FC } from '@rue-js/rue'

declare global {
  var __rueIslandFixtureHydrationOrder: string[] | undefined
}

export const hydrate = (island: Element, props: ComponentProps) => {
  const id = island.getAttribute('data-rue-id') ?? ''
  ;(globalThis.__rueIslandFixtureHydrationOrder ??= []).push(id)
  island.setAttribute('data-fixture-hydrated', String(props.label ?? id))
}

const Counter: FC<{ label: string }> = props => (
  <button type="button" data-fixture-counter="true">
    {props.label}
  </button>
)

export default Counter
