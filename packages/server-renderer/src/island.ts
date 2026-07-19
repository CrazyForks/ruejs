/*
Rue server-renderer island entry
- Exposes server-facing helpers for emitting Rue island containers and props.
- The underlying implementation lives in @rue-js/runtime/island so the browser
  loader and server markup helpers share one protocol definition.
*/
export {
  RUE_ISLAND_DESCRIPTOR,
  RUE_ISLAND_ELEMENT,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  RUE_SERVER_ISLAND_DESCRIPTOR,
  createRueIslandDescriptor,
  createRueServerIslandDescriptor,
  createRueIslandId,
  createIslandContainerHtml,
  deserializeIslandProps,
  escapeIslandAttribute,
  escapeIslandJson,
  serializeIslandProps,
  type RueIslandHtmlOptions,
  type RueIslandDescriptor,
  type RueIslandDescriptorMetadata,
  type RueIslandDescriptorOptions,
  type RueIslandHydrationStrategy,
  type RueIslandManifest,
  type RueIslandManifestEntry,
  type RueServerIslandDescriptor,
  type RueServerIslandDescriptorOptions,
} from '@rue-js/runtime/island'
