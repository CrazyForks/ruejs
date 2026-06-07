import { type FC } from '@rue-js/rue'

const Home: FC = () => (
  <section class="panel">
    <p class="eyebrow">Vite + Express SSR</p>
    <h1>Rue rendered on the server</h1>
    <p class="lede">
      This route is rendered per request through Vite middleware, Rue Router and
      @rue-js/server-renderer.
    </p>
  </section>
)

export default Home
