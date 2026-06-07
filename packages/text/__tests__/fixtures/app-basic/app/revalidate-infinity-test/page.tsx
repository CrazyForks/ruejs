// Fixture for classifyAppRoute integration test: revalidate=Infinity → static.
// Text.js treats revalidate=Infinity as "never revalidate" (fully static).
export const revalidate = Infinity

export default function RevalidateInfinityPage() {
  return <p>revalidate-infinity</p>
}
