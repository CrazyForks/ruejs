import { cookies } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const jar = await cookies()
  jar.set('session', 'abc123', { path: '/' })
  return TextResponse.json({ ok: true })
}
