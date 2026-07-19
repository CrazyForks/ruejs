import { type FC } from '@rue-js/rue'

import UserPanel from './UserPanel'

export const App: FC = () => (
  <main>
    <h1>Cacheable Rue shell</h1>
    <p>This heading is available without waiting for personalized rendering.</p>
    <UserPanel
      server:defer
      layout="compact"
      fallback={<p aria-busy="true">Loading your account…</p>}
    />
  </main>
)
