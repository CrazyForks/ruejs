import { headers } from 'text/headers'
import { TextResponse, type TextRequest } from 'text/server'

export async function GET(request: TextRequest) {
  const requestHeaders = await headers()

  return TextResponse.json({
    requestAuthorization: request.headers.get('authorization'),
    requestCookie: request.headers.get('cookie'),
    requestMiddlewareHeader: request.headers.get('x-from-middleware'),
    headersApiAuthorization: requestHeaders.get('authorization'),
    headersApiCookie: requestHeaders.get('cookie'),
    headersApiMiddlewareHeader: requestHeaders.get('x-from-middleware'),
  })
}
