import { describe, expect, test } from 'vitest'
import {
  RUE_ELEMENT_SYMBOL,
  RUE_FRAGMENT_SYMBOL,
  RUE_SERVER_REFERENCE_SYMBOL,
  RUE_SUSPENSE_SYMBOL,
  RUE_TRANSITIONAL_ELEMENT_SYMBOL,
  decodeRuePayloadReadableStream,
  renderRuePayloadToReadableStream,
} from './payload'

type DecodedElement = {
  $$typeof: symbol
  props: {
    fallback: symbol
  }
  type: symbol
}

type DecodedServerReference = Function & {
  $$bound: unknown
  $$id: string
  $$typeof: symbol
}

describe('Rue RSC payload symbols', () => {
  test('round-trips Rue element and well-known Rue symbols', async () => {
    const payload = {
      $$typeof: RUE_ELEMENT_SYMBOL,
      type: RUE_FRAGMENT_SYMBOL,
      key: 'root',
      props: {
        fallback: RUE_SUSPENSE_SYMBOL,
        children: 'hello',
      },
    }

    const decoded = await decodeRuePayloadReadableStream<DecodedElement>(
      renderRuePayloadToReadableStream(payload),
    )

    expect(decoded.$$typeof).toBe(RUE_ELEMENT_SYMBOL)
    expect(decoded.type).toBe(RUE_FRAGMENT_SYMBOL)
    expect(decoded.props.fallback).toBe(RUE_SUSPENSE_SYMBOL)
  })

  test('accepts transitional Rue protocol elements', async () => {
    const payload = {
      $$typeof: RUE_TRANSITIONAL_ELEMENT_SYMBOL,
      type: RUE_FRAGMENT_SYMBOL,
      key: 'root',
      props: {
        children: 'hello',
      },
    }

    const decoded = await decodeRuePayloadReadableStream<DecodedElement>(
      renderRuePayloadToReadableStream(payload),
    )

    expect(decoded.$$typeof).toBe(RUE_ELEMENT_SYMBOL)
    expect(decoded.type).toBe(RUE_FRAGMENT_SYMBOL)
  })

  test('passes through Rue context provider children without executing the provider', async () => {
    function Provider() {
      throw new Error('provider should not execute while encoding RSC payloads')
    }
    Object.defineProperty(Provider, '__rue_context_provider__', { value: true })

    const decoded = await decodeRuePayloadReadableStream<string>(
      renderRuePayloadToReadableStream({
        $$typeof: RUE_ELEMENT_SYMBOL,
        type: Provider,
        key: null,
        props: {
          value: 'runtime',
          children: 'inside',
        },
      }),
    )

    expect(decoded).toBe('inside')
  })

  test('round-trips server references with Rue server symbol', async () => {
    function action() {}
    Object.defineProperties(action, {
      $$typeof: { value: RUE_SERVER_REFERENCE_SYMBOL },
      $$id: { value: '/actions.ts#save' },
      $$bound: { value: ['draft'] },
    })

    const decoded = await decodeRuePayloadReadableStream<[DecodedServerReference]>(
      renderRuePayloadToReadableStream([action]),
    )

    expect(decoded[0].$$typeof).toBe(RUE_SERVER_REFERENCE_SYMBOL)
    expect(decoded[0].$$id).toBe('/actions.ts#save')
    expect(decoded[0].$$bound).toEqual(['draft'])
  })

  test('rejects non-Rue function values', async () => {
    function action() {}

    await expect(
      decodeRuePayloadReadableStream(renderRuePayloadToReadableStream(action)),
    ).rejects.toThrow('[rue-rsc] Cannot encode function values in a payload')
  })

  test('encodes redirect and notFound digest errors as Rue payload control frames', async () => {
    const redirectError = Object.assign(new Error('redirect'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    })
    const notFoundError = Object.assign(new Error('missing'), {
      digest: 'NEXT_NOT_FOUND',
    })

    const text = await new Response(
      renderRuePayloadToReadableStream(
        { redirect: redirectError, missing: notFoundError },
        {
          onError(error) {
            return error instanceof Error
              ? (error as Error & { digest?: string }).digest
              : undefined
          },
        },
      ),
    ).text()

    expect(text).toContain('"$rue":"redirect"')
    expect(text).toContain('"$rue":"notFound"')
    expect(text).toContain('NEXT_REDIRECT')
    expect(text).toContain('NEXT_NOT_FOUND')
  })
})
