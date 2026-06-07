// Fixture for classifyAppRoute integration test: revalidate=false → static.
// Text.js treats revalidate=false as "never revalidate" (fully static, cache indefinitely).
// Ported from Text.js: https://textjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const revalidate = false

export default function RevalidateFalsePage() {
  return <p>revalidate-false</p>
}
