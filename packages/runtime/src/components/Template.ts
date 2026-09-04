import type { FC, PropsWithChildren } from '../rue'
import { Template as compiledTemplate } from '../compiler-runtime/builtins'

export type TemplateProps = PropsWithChildren<Record<string, unknown>>

/** Transparent compiled slot carrier; it never interprets arbitrary children. */
export const Template = compiledTemplate as unknown as FC<TemplateProps>
