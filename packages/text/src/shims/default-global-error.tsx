'use client'

import type { TextNode } from '../runtime/render-protocol.js'

/**
 * Ported from Text.js's built-in default global error component:
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/builtin/global-error.tsx
 *
 * Rendered when an unhandled error reaches the root error boundary and the
 * user has not supplied their own `app/global-error.tsx`. Matches the
 * markup, inline styles, and theme CSS that Text.js's
 * `test/e2e/app-dir/default-error-page-ui/default-error-page-ui.test.ts`
 * exercises:
 *   - `<h1>` reads "This page couldn't load"
 *   - `<p>` contains "Reload to try again, or go back" (client error) or
 *     "A server error occurred. Reload to try again." (server error)
 *   - First `<button>` is "Reload" (form submit triggers a page reload)
 *   - Second `<button>` is "Back" (only for client errors)
 *   - Server errors render an "ERROR <digest>" footer
 *   - SVG warning icon is 32x32
 */

type DefaultGlobalErrorProps = {
  error: { digest?: string } | null | undefined
  reset?: () => void
}

const errorStyles = {
  container: {
    fontFamily:
      'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: '-32px',
    maxWidth: '325px',
    padding: '32px 28px',
    textAlign: 'left' as const,
  },
  icon: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    lineHeight: '32px',
    margin: '0 0 12px 0',
    color: 'var(--text-error-title)',
  },
  message: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '21px',
    margin: '0 0 20px 0',
    color: 'var(--text-error-message)',
  },
  form: {
    margin: 0,
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-error-btn-text)',
    background: 'var(--text-error-btn-bg)',
    border: 'var(--text-error-btn-border)',
  },
  buttonSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-error-btn-secondary-text)',
    background: 'var(--text-error-btn-secondary-bg)',
    border: 'var(--text-error-btn-secondary-border)',
  },
  digestFooter: {
    position: 'fixed' as const,
    bottom: '32px',
    left: '0',
    right: '0',
    textAlign: 'center' as const,
    fontFamily: 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace',
    fontSize: '12px',
    lineHeight: '18px',
    fontWeight: 400,
    margin: '0',
    color: 'var(--text-error-digest)',
  },
} as const

const errorThemeCss = `
:root {
  --text-error-bg: #fff;
  --text-error-text: #171717;
  --text-error-title: #171717;
  --text-error-message: #171717;
  --text-error-digest: #666666;
  --text-error-btn-text: #fff;
  --text-error-btn-bg: #171717;
  --text-error-btn-border: none;
  --text-error-btn-secondary-text: #171717;
  --text-error-btn-secondary-bg: transparent;
  --text-error-btn-secondary-border: 1px solid rgba(0,0,0,0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --text-error-bg: #0a0a0a;
    --text-error-text: #ededed;
    --text-error-title: #ededed;
    --text-error-message: #ededed;
    --text-error-digest: #a0a0a0;
    --text-error-btn-text: #0a0a0a;
    --text-error-btn-bg: #ededed;
    --text-error-btn-border: none;
    --text-error-btn-secondary-text: #ededed;
    --text-error-btn-secondary-bg: transparent;
    --text-error-btn-secondary-border: 1px solid rgba(255,255,255,0.14);
  }
}
body { margin: 0; color: var(--text-error-text); background: var(--text-error-bg); }
`.replace(/\n\s*/g, '')

function WarningIcon(): TextNode {
  return (
    <svg width="32" height="32" viewBox="-0.2 -1.5 32 32" fill="none" style={errorStyles.icon}>
      <path
        d="M16.9328 0C18.0839 0.000116771 19.1334 0.658832 19.634 1.69531L31.4299 26.1309C32.0708 27.4588 31.1036 28.9999 29.6291 29H2.00215C0.527541 29 -0.439628 27.4588 0.201371 26.1309L11.9973 1.69531C12.4979 0.658823 13.5474 7.75066e-05 14.6984 0H16.9328ZM3.59493 26H28.0363L16.9328 3H14.6984L3.59493 26ZM15.8156 19C16.9202 19.0001 17.8156 19.8955 17.8156 21C17.8156 22.1045 16.9202 22.9999 15.8156 23C14.7111 23 13.8156 22.1046 13.8156 21C13.8156 19.8954 14.7111 19 15.8156 19ZM17.3156 16.5H14.3156V8.5H17.3156V16.5Z"
        fill="var(--text-error-title)"
      />
    </svg>
  )
}

function handleBackClick() {
  if (typeof window === 'undefined') return
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = '/'
  }
}

function DefaultGlobalError({ error }: DefaultGlobalErrorProps): TextNode {
  const digest: string | undefined = error?.digest
  const isServerError = !!digest

  const message = isServerError
    ? 'A server error occurred. Reload to try again.'
    : 'Reload to try again, or go back.'

  return (
    <html id="__text_error__">
      <head>
        <style dangerouslySetInnerHTML={{ __html: errorThemeCss }} />
      </head>
      <body>
        <div style={errorStyles.container}>
          <div style={errorStyles.card}>
            <WarningIcon />
            <h1 style={errorStyles.title}>This page couldn&#x2019;t load</h1>
            <p style={errorStyles.message}>{message}</p>
            <div style={errorStyles.buttonGroup}>
              <form style={errorStyles.form}>
                <button type="submit" style={errorStyles.button}>
                  Reload
                </button>
              </form>
              {!isServerError && (
                <button type="button" style={errorStyles.buttonSecondary} onClick={handleBackClick}>
                  Back
                </button>
              )}
            </div>
          </div>
        </div>
        {digest && <p style={errorStyles.digestFooter}>ERROR {digest}</p>}
      </body>
    </html>
  )
}

export default DefaultGlobalError
