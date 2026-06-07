/**
 * Route handler supporting all HTTP methods.
 *
 * Ported from: https://github.com/opennextjs/opennextjs-cloudflare/blob/main/examples/e2e/app-router/open-text/app/methods/route.ts
 * Tests: ON-3 in TRACKING.md
 */

import { TextResponse } from 'text/server'

export async function GET() {
  return TextResponse.json(
    { message: 'text route handler' },
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'special-header': 'text is great',
      },
    },
  )
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData()
    const name = formData.get('name')
    const email = formData.get('email')
    return TextResponse.json({ message: 'ok', name, email }, { status: 202 })
  }

  const body = await request.text()
  if (body.includes('not awesome')) {
    return TextResponse.json({ message: 'forbidden' }, { status: 403 })
  }
  return TextResponse.json({ message: 'ok' }, { status: 202 })
}

export async function PUT(request: Request) {
  const body = await request.json()
  return TextResponse.json({ message: 'ok', ...body }, { status: 201 })
}

export async function PATCH(_request: Request) {
  return TextResponse.json(
    { message: 'ok', modified: true, timestamp: new Date().toISOString() },
    { status: 202 },
  )
}

export async function DELETE(_request: Request) {
  return new Response(null, { status: 204 })
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'special-header': 'text is great',
    },
  })
}
