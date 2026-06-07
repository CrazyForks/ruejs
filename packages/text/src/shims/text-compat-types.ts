import type { TextComponentType, TextElement, TextNode } from '../runtime/render-protocol'

export type TextCompatComponentType<P = {}> = TextComponentType<P>
export type TextCompatElement<P = unknown> = TextElement<P>
export type TextCompatNode = TextNode

export type RueCompatComponentType<P = {}> = TextCompatComponentType<P>
export type RueCompatNode = TextCompatNode
