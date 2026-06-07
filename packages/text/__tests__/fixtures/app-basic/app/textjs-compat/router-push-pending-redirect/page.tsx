import { redirect } from 'text/navigation'

// Server component that immediately redirects to the destination.
// Used to test that isPending stays true through an RSC-level redirect
// when triggered by router.push() inside startTransition.
export default function RouterPushPendingRedirectPage() {
  redirect('/textjs-compat/router-push-pending-destination')
}
