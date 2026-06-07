import { cookies } from 'text/headers'
import { redirect } from 'text/navigation'

export async function POST(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('route-redirect', 'preserved', { path: '/' })

  redirect('/textjs-compat/route-handler-redirects?success=true')
}
