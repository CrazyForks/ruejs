import { cookies } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const cookieStore = await cookies()
  cookieStore.set('session', 'abc123', { path: '/', httpOnly: true })
  cookieStore.set('theme', 'dark')

  return TextResponse.json({ ok: true, message: 'Cookies set' })
}

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('session')

  return TextResponse.json({ ok: true, message: 'Cookie deleted' })
}
