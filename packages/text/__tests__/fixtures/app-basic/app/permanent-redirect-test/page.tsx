import { permanentRedirect } from 'text/navigation'

// permanentRedirect() returns a 308 status code
export default function PermanentRedirectTestPage() {
  permanentRedirect('/about')
}
