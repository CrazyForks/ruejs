import { Suspense, type RenderableOutput } from '@rue-js/rue'

async function DelayedChunk(): Promise<RenderableOutput> {
  await new Promise(resolve => setTimeout(resolve, 600))
  return <div data-testid="gssp-streamed-content">Delayed gSSP stream content loaded</div>
}

export async function getServerSideProps({
  res,
}: {
  res: { setHeader: (key: string, value: string) => void }
}) {
  // Simulate a userland length that would be stale once the streamed HTML starts flowing.
  res.setHeader('Content-Length', '1')
  return { props: {} }
}

export default function StreamingGsspContentLengthPage() {
  return (
    <main>
      <h1>Streaming gSSP Content-Length Test</h1>
      <Suspense
        fallback={<div data-testid="gssp-streaming-fallback">Loading delayed gSSP chunk...</div>}
      >
        <DelayedChunk />
      </Suspense>
    </main>
  )
}
