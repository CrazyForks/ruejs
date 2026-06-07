import { permanentRedirect } from 'text/navigation'

export function POST(): void {
  permanentRedirect('/textjs-compat/route-handler-redirects?success=true')
}
