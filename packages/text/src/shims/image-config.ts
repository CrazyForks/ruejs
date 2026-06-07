import ipaddr from 'ipaddr.js'

/**
 * Image remote pattern validation.
 *
 * Validates remote image URLs against the `images.remotePatterns` and
 * `images.domains` config from text.config.js. This prevents SSRF and
 * open-redirect attacks by blocking URLs that don't match any configured
 * pattern.
 *
 * Pattern matching follows Text.js semantics:
 * - `*` matches a single segment (subdomain in hostname, path segment in pathname)
 * - `**` matches any number of segments
 * - protocol, port, and search are matched exactly when specified
 */

export type RemotePattern = {
  protocol?: string
  hostname: string
  port?: string
  pathname?: string
  search?: string
}

/**
 * Convert a glob pattern (with `*` and `**`) to a RegExp.
 *
 * For hostnames, segments are separated by `.`:
 *   - `*` matches a single segment (no dots): [^.]+
 *   - `**` matches any number of segments: .+
 *
 * For pathnames, segments are separated by `/`:
 *   - `*` matches a single segment (no slashes): [^/]+
 *   - `**` matches any number of segments (including empty): .*
 *
 * Literal characters are escaped for regex safety.
 */
function globToRegex(pattern: string, separator: '.' | '/'): RegExp {
  // Split by ** first, then handle * within each part
  let regexStr = '^'
  const doubleStar = separator === '.' ? '.+' : '.*'
  const singleStar = separator === '.' ? '[^.]+' : '[^/]+'

  const parts = pattern.split('**')
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      regexStr += doubleStar
    }
    // Within each part, split by * and escape the literals
    const subParts = parts[i].split('*')
    for (let j = 0; j < subParts.length; j++) {
      if (j > 0) {
        regexStr += singleStar
      }
      // Escape regex special chars in the literal portion
      regexStr += subParts[j].replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    }
  }
  regexStr += '$'
  return new RegExp(regexStr)
}

/**
 * Check whether a URL matches a single remote pattern.
 * Follows the same semantics as Text.js's matchRemotePattern().
 */
export function matchRemotePattern(pattern: RemotePattern, url: URL): boolean {
  // Protocol check (strip trailing colon for comparison)
  if (pattern.protocol !== undefined) {
    if (pattern.protocol.replace(/:$/, '') !== url.protocol.replace(/:$/, '')) {
      return false
    }
  }

  // Port check
  if (pattern.port !== undefined) {
    if (pattern.port !== url.port) {
      return false
    }
  }

  // Hostname check (required field)
  if (!globToRegex(pattern.hostname, '.').test(url.hostname)) {
    return false
  }

  // Search/query string check
  if (pattern.search !== undefined) {
    if (pattern.search !== url.search) {
      return false
    }
  }

  // Pathname check — defaults to ** (match everything) if not specified
  const pathnamePattern = pattern.pathname ?? '**'
  if (!globToRegex(pathnamePattern, '/').test(url.pathname)) {
    return false
  }

  return true
}

/**
 * Check whether a URL matches any configured remote pattern or legacy domain.
 */
export function hasRemoteMatch(
  domains: string[],
  remotePatterns: RemotePattern[],
  url: URL,
): boolean {
  return (
    domains.some(domain => url.hostname === domain) ||
    remotePatterns.some(p => matchRemotePattern(p, url))
  )
}

// ─── Private IP detection ───────────────────────────────────────────────

const EXTRA_NON_PUBLIC_IPV4_RANGES: Array<[ipaddr.IPv4, number]> = [
  [ipaddr.IPv4.parse('100.64.0.0'), 10],
  [ipaddr.IPv4.parse('198.18.0.0'), 15],
  [ipaddr.IPv4.parse('224.0.0.0'), 4],
  [ipaddr.IPv4.parse('240.0.0.0'), 4],
  [ipaddr.IPv4.parse('192.0.0.0'), 24],
  [ipaddr.IPv4.parse('198.51.100.0'), 24],
  [ipaddr.IPv4.parse('203.0.113.0'), 24],
]

const EXTRA_NON_PUBLIC_IPV6_RANGES: Array<[ipaddr.IPv6, number]> = [
  [ipaddr.IPv6.parse('2001::'), 32],
  [ipaddr.IPv6.parse('2001:2::'), 48],
  [ipaddr.IPv6.parse('2001:db8::'), 32],
  [ipaddr.IPv6.parse('100::'), 64],
  [ipaddr.IPv6.parse('64:ff9b::'), 96],
]

function isExtraNonPublicIp(parsed: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  if (parsed instanceof ipaddr.IPv4) {
    return EXTRA_NON_PUBLIC_IPV4_RANGES.some(range => parsed.match(range))
  }
  return EXTRA_NON_PUBLIC_IPV6_RANGES.some(range => parsed.match(range))
}

/**
 * Determine whether a string is a private (non-routable) IP address.
 * Works for IPv4 and IPv6, including bracketed and IPv4-mapped forms.
 *
 * Uses ipaddr.js with range() !== 'unicast' — the same approach Text.js
 * takes (via packages/text/src/server/is-private-ip.ts). This covers all
 * IETF non-unicast ranges (CGNAT, benchmarking, multicast, reserved,
 * teredo, documentation, discard, NAT64, etc.) without hand-rolling CIDR
 * prefix checks that are easy to get wrong.
 *
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/server/is-private-ip.ts
 */
export function isPrivateIp(ip: string): boolean {
  // Strip IPv6 brackets so ipaddr.js can parse the raw address.
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1)
  }

  try {
    const parsed = ipaddr.parse(ip)
    // IPv4-mapped addresses are classified as "ipv4Mapped" by ipaddr.js,
    // not "unicast". We must look at the embedded IPv4 address to decide
    // whether it's private (e.g., ::ffff:127.0.0.1) or public.
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      const ipv4 = parsed.toIPv4Address()
      return ipv4.range() !== 'unicast' || isExtraNonPublicIp(ipv4)
    }
    return parsed.range() !== 'unicast' || isExtraNonPublicIp(parsed)
  } catch {
    // Not a valid IP address (e.g., a domain name) — not private.
    return false
  }
}
