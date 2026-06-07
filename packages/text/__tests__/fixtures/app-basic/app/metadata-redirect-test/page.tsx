import { redirect } from 'text/navigation'

// generateMetadata throws redirect(). In Text.js, metadata resolution is
// suspended/streamed, so the SSR response stays 200 (the redirect is encoded
// in the streamed RSC payload). Same behavior for the RSC navigation
// request — see https://github.com/cloudflare/vinext/issues/1347 and Text.js's
// test/e2e/app-dir/metadata-navigation/metadata-navigation.test.ts
// ("should support redirect in generateMetadata").
export async function generateMetadata() {
  redirect('/about')
}

export default function MetadataRedirectTestPage() {
  return <div data-testid="metadata-redirect-page">metadata redirect page</div>
}
