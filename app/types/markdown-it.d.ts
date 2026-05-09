interface MarkdownItOptions {
  html?: boolean
  linkify?: boolean
  breaks?: boolean
  typographer?: boolean
}

declare class MarkdownIt {
  constructor(options?: MarkdownItOptions)
  render(source: string): string
  use(plugin: unknown, ...args: unknown[]): this
}

export default MarkdownIt
