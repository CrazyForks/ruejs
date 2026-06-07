import { type FC } from '@rue-js/rue'

const Dashboard: FC = () => (
  <section class="panel">
    <p class="eyebrow">route-specific content</p>
    <h1>Server data shaped UI</h1>
    <p class="lede">
      This page stands in for a protected or data-heavy screen that still gets a complete first HTML
      response.
    </p>
  </section>
)

export default Dashboard
