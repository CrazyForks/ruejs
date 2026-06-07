import { cookies, headers } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const headerStore = headers() as Promise<Headers> & Headers
  let headerError = 'none'

  try {
    headerStore.set('x-repeat', 'mutated')
  } catch (error) {
    headerError = error instanceof Error ? error.message : String(error)
  }

  const cookieStore = cookies() as Promise<any> & {
    get(name: string): { name: string; value: string } | undefined
    set(name: string, value: string, options?: Record<string, unknown>): unknown
  }
  cookieStore.set('repeat-cookie', 'repeat-value', { path: '/', httpOnly: true })

  const awaitedHeaders = await headers()
  const awaitedCookies = await cookies()

  return TextResponse.json({
    firstHeader: headerStore.get('x-repeat'),
    secondHeader: awaitedHeaders.get('x-repeat'),
    headerError,
    repeatCookie: awaitedCookies.get('repeat-cookie')?.value ?? null,
  })
}
