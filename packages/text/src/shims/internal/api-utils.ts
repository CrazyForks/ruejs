/**
 * Shim for text/dist/server/api-utils
 *
 * Used by: @clerk/textjs (type-only import of TextApiRequestCookies).
 */
export type TextApiRequestCookies = Partial<{ [key: string]: string }>
export type TextApiRequestQuery = Partial<{ [key: string]: string | string[] }>
