/** Compiler binding for class values; nullish/false values clear the class. */
export const _$setClassName = (element: Element, value: unknown): void => {
  const normalized = value == null || value === false ? '' : String(value)
  if (element instanceof SVGElement) element.setAttribute('class', normalized)
  else (element as HTMLElement).className = normalized
}
