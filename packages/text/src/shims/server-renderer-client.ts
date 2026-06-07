function createClientServerRendererError(name: string): Error {
  return new Error(`[text] ${name} is only available in server environments.`)
}

export async function renderToString(): Promise<string> {
  throw createClientServerRendererError('renderToString')
}

export async function runWithServerDOMAdapter(): Promise<never> {
  throw createClientServerRendererError('runWithServerDOMAdapter')
}
