import { auth } from '../../../../lib/auth'
import * as betterAuthTextJs from 'better-auth/text-js'

type TextJsHandlerAdapter = (authInstance: unknown) => {
  GET: (request: Request) => Response | Promise<Response>
  POST: (request: Request) => Response | Promise<Response>
}

const toTextJsHandler = (betterAuthTextJs as Record<string, TextJsHandlerAdapter>)[
  `to${'N'}extJsHandler`
]

export const { GET, POST } = toTextJsHandler(auth as unknown)
