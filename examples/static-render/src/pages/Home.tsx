import { type FC } from '@rue-js/rue'

const Home: FC = () => (
  <section class="panel">
    <p class="eyebrow">prerendered entry</p>
    <h1>Rue Static Render</h1>
    <p class="lede">
      This page was rendered to HTML at build time through Rue Router and a lazy route component.
    </p>
    <div class="status">
      <span>Route</span>
      <strong>/</strong>
    </div>
  </section>
)

export default Home
