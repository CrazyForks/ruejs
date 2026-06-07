// Tests that params named then, catch, finally, and status work correctly.
// These names shadow Promise/Rue well-known properties, so the thenable
// wrapper must protect them until the params are awaited.
export default async function ParamsShadowPage({
  params,
  searchParams,
}: {
  params: Promise<{ then: string; catch: string; finally: string; status: string }>
  searchParams: Promise<{ then?: string; catch?: string; finally?: string; status?: string }>
}) {
  const [resolved, resolvedSearchParams] = await Promise.all([params, searchParams])
  return (
    <main>
      <h1>Params Shadow Test</h1>
      <p data-testid="then">{resolved.then}</p>
      <p data-testid="catch">{resolved.catch}</p>
      <p data-testid="finally">{resolved.finally}</p>
      <p data-testid="status">{resolved.status}</p>
      <p data-testid="is-thenable">{typeof params.then === 'function' ? 'yes' : 'no'}</p>
      <p data-testid="search-then">{resolvedSearchParams.then}</p>
      <p data-testid="search-catch">{resolvedSearchParams.catch}</p>
      <p data-testid="search-finally">{resolvedSearchParams.finally}</p>
      <p data-testid="search-status">{resolvedSearchParams.status}</p>
      <p data-testid="search-is-thenable">
        {typeof searchParams.then === 'function' ? 'yes' : 'no'}
      </p>
    </main>
  )
}
