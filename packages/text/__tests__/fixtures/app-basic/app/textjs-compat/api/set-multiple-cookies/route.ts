import { cookies } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const jar = await cookies()
  jar.set('token', 'xyz', { path: '/', httpOnly: true })
  jar.set('theme', 'dark', { path: '/' })
  return TextResponse.json({ ok: true })
}
