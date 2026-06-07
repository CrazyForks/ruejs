import { type FC } from '@rue-js/rue'

const About: FC = () => (
  <section class="panel">
    <p class="eyebrow">Rue Router</p>
    <h1>Multiple SSR routes</h1>
    <p class="lede">
      The Node server forwards every page request into the same Rue SSR entry, then the router
      chooses the lazy page component.
    </p>
  </section>
)

export default About
