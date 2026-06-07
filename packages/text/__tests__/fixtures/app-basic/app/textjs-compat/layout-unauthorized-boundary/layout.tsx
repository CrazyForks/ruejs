import { unauthorized } from 'text/navigation'

/**
 * Text.js compat: unauthorized/basic — access fallback thrown from a layout
 * should render the matching unauthorized boundary, not the not-found boundary.
 */
export default function Layout() {
  unauthorized()
}
