import { TextResponse } from 'text/server'

export function GET(request: Request) {
  return TextResponse.rewrite(new URL('/api/hello', request.url))
}
