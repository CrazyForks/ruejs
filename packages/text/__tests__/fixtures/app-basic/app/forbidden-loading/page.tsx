import { forbidden } from 'text/navigation'

// Async page wrapped by route-level loading.tsx that throws forbidden() (403).
// Exercises the post-shell digest swap path for TEXT_HTTP_ERROR_FALLBACK;403
// — verifies the status code from the digest is preserved (not coerced to 404)
// and the root forbidden.tsx boundary is rendered.
export default async function ForbiddenLoadingPage() {
  forbidden()
}
