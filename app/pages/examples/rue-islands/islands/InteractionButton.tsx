import { h, render, type ComponentProps, type FC } from '@rue-js/rue'
import type { RueIslandMountContext } from '@rue-js/rue/island'

export interface InteractionButtonProps {
  label: string
}

const InteractionButton: FC<InteractionButtonProps & { replayed?: boolean }> = props => (
  <button
    type="button"
    className="btn btn-primary h-auto min-h-24 justify-start p-5 text-left"
    data-example-state="hydrated"
  >
    <span>
      <span className="block text-xs font-bold uppercase tracking-wide opacity-80">
        client:interaction
      </span>
      <span className="mt-1 block">
        {props.replayed ? `${props.label} hydrated from the first click` : props.label}
      </span>
    </span>
  </button>
)

export const hydrate = (island: Element, props: ComponentProps, context: RueIslandMountContext) => {
  const typedProps = props as InteractionButtonProps
  render(
    h(InteractionButton, {
      ...typedProps,
      replayed: context.replayEvent?.type === 'click',
    }),
    island as HTMLElement,
  )
}

export default InteractionButton
