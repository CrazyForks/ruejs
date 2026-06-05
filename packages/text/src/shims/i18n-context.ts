/**
 * Per-request i18n context accessors.
 *
 * This is a bridge module (no node:async_hooks dependency) that both
 * client and server code can import safely.  The server-only
 * `i18n-state.ts` registers ALS-backed implementations on import;
 * until then the fallback globalThis accessors are used.
 */

import type { DomainLocale } from '../utils/domain-locale.js'

export type I18nContext = {
  locale?: string
  locales?: string[]
  defaultLocale?: string
  domainLocales?: readonly DomainLocale[]
  hostname?: string
}

// ---------------------------------------------------------------------------
// Fallback: read/write bare globalThis (unsafe for concurrent requests).
// Replaced by ALS-backed accessors when i18n-state.ts is imported.
// ---------------------------------------------------------------------------

let _getI18nContext = (): I18nContext | null => {
  // Return null when no i18n globals have been set
  if (globalThis.__TEXT_DEFAULT_LOCALE__ == null && globalThis.__TEXT_LOCALE__ == null) {
    return null
  }
  return {
    locale: globalThis.__TEXT_LOCALE__,
    locales: globalThis.__TEXT_LOCALES__,
    defaultLocale: globalThis.__TEXT_DEFAULT_LOCALE__,
    domainLocales: globalThis.__TEXT_DOMAIN_LOCALES__,
    hostname: globalThis.__TEXT_HOSTNAME__,
  }
}

let _setI18nContextImpl = (ctx: I18nContext | null): void => {
  if (ctx) {
    globalThis.__TEXT_LOCALE__ = ctx.locale
    globalThis.__TEXT_LOCALES__ = ctx.locales as string[] | undefined
    globalThis.__TEXT_DEFAULT_LOCALE__ = ctx.defaultLocale
    globalThis.__TEXT_DOMAIN_LOCALES__ =
      ctx.domainLocales as typeof globalThis.__TEXT_DOMAIN_LOCALES__
    globalThis.__TEXT_HOSTNAME__ = ctx.hostname
  } else {
    globalThis.__TEXT_LOCALE__ = undefined
    globalThis.__TEXT_LOCALES__ = undefined
    globalThis.__TEXT_DEFAULT_LOCALE__ = undefined
    globalThis.__TEXT_DOMAIN_LOCALES__ = undefined
    globalThis.__TEXT_HOSTNAME__ = undefined
  }
}

/**
 * Register ALS-backed accessors. Called by i18n-state.ts on import.
 * @internal
 */
export function _registerI18nStateAccessors(accessors: {
  getI18nContext: () => I18nContext | null
  setI18nContext: (ctx: I18nContext | null) => void
}): void {
  _getI18nContext = accessors.getI18nContext
  _setI18nContextImpl = accessors.setI18nContext
}

export function getI18nContext(): I18nContext | null {
  return _getI18nContext()
}

export function setI18nContext(ctx: I18nContext | null): void {
  _setI18nContextImpl(ctx)
}
