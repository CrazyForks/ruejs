import { cookies } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const jar = await cookies()
  const session = jar.get('session')
  return TextResponse.json({ session: session?.value ?? null })
}
