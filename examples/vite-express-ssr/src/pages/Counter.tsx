import { type FC, useState } from '@rue-js/rue'

const Counter: FC = () => {
  const [count, setCount] = useState(0)

  return (
    <section class="panel">
      <p class="eyebrow">client interaction</p>
      <h1>SSR counter route</h1>
      <p class="lede">
        The route component is lazy-loaded for SSR, then mounted on the client so the counter can
        update.
      </p>
      <div class="counter">
        <button type="button" onClick={() => setCount(value => value - 1)}>
          -
        </button>
        <strong>{count}</strong>
        <button type="button" onClick={() => setCount(value => value + 1)}>
          +
        </button>
      </div>
    </section>
  )
}

export default Counter
