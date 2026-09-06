import { type FC, useState } from '@rue-js/rue'

const Counter: FC = () => {
  const [count, setCount] = useState(0)

  return (
    <section class="panel">
      <p class="eyebrow">interactive island</p>
      <h1>Counter route</h1>
      <p class="lede">
        This route is prerendered as HTML, then the client entry mounts Rue so the counter becomes
        interactive.
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
