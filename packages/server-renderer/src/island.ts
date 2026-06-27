/*
Rue server-renderer island entry
- Exposes server-facing helpers for emitting Rue island containers and props.
- The underlying implementation lives in @rue-js/runtime/island so the browser
  loader and server markup helpers share one protocol definition.
*/
export {
  RUE_ISLAND_ELEMENT,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  createRueIslandId,
  createIslandContainerHtml,
  deserializeIslandProps,
  escapeIslandAttribute,
  escapeIslandJson,
  serializeIslandProps,
  type RueIslandHtmlOptions,
  type RueIslandHydrationStrategy,
  type RueIslandManifest,
  type RueIslandManifestEntry,
} from '@rue-js/runtime/island'
