import { type FC } from '@rue-js/rue'

const NotFound: FC = () => (
  <section class="panel">
    <p class="eyebrow">404</p>
    <h1>Route not found</h1>
    <p class="lede">
      Express handled the URL, then Rue Router rendered this lazy fallback route on the server.
    </p>
  </section>
)

export default NotFound
