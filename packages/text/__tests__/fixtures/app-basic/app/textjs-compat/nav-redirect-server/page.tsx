import { redirect } from 'text/navigation'

// Server component that calls redirect() — should produce 307
export default function Page() {
  redirect('/textjs-compat/nav-redirect-result')
}
