import { type FC } from '@rue-js/rue'
import { renderToString } from '@rue-js/server-renderer'
import { encodeServerIslandPayload } from '@rue-js/server-renderer/server-island'

import { App } from './App'

export const renderPage = (key: Uint8Array) =>
  renderToString(App, {
    serverIslands: {
      endpoint: '/_rue/server-island',
      encode: payload =>
        encodeServerIslandPayload({
          ...payload,
          expiresAt: Date.now() + 5 * 60_000,
          key,
        }),
    },
  })

export const renderServerIsland = (
  component: FC<any>,
  props: Record<string, unknown>,
  request: Request,
) => {
  // This demo adapter owns authentication. Production code should validate a real session.
  const username = request.headers.get('cookie')?.includes('session=demo') ? 'Rue user' : 'Guest'
  return renderToString(component, { props: { ...props, username } })
}
