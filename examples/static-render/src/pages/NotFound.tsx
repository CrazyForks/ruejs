import { type FC } from '@rue-js/rue'

const NotFound: FC = () => (
  <section class="panel">
    <p class="eyebrow">404</p>
    <h1>Static route not found</h1>
    <p class="lede">This fallback is still provided by the Rue Router route table.</p>
  </section>
)

export default NotFound
