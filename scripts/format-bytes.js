/**
 * @param {number} bytes
 * @param {{ minimumFractionDigits?: number }} [options]
 */
export function formatBytes(bytes, options = {}) {
  const { minimumFractionDigits = 0 } = options

  if (!Number.isFinite(bytes)) {
    return '0 B'
  }

  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  let value = Math.abs(bytes)
  let unitIndex = 0

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000
    unitIndex += 1
  }

  const signedValue = bytes < 0 ? -value : value
  const maximumFractionDigits = Math.max(minimumFractionDigits, unitIndex === 0 ? 0 : 3)

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(signedValue)} ${units[unitIndex]}`
}
