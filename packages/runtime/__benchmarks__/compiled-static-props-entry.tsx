import { signal } from '@rue-js/rue/internal'

type CardProps = {
  label: string
  tone: string
  optional?: string
  onClick: () => void
}

const state = signal<CardProps>({
  label: 'one',
  tone: 'tone-one',
  optional: 'present',
  onClick: () => undefined,
})

const Card = (props: CardProps) => (
  <button className={props.tone} data-optional={props.optional} onClick={props.onClick}>
    {props.label}
  </button>
)

export const updateCard = (next: CardProps) => state.set(next)

export const App = () => (
  <main>
    <Card
      label={state.get().label}
      tone={state.get().tone}
      optional={state.get().optional}
      onClick={state.get().onClick}
    />
  </main>
)
