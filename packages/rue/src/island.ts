/*
Rue island entry
- Exposes the SSR island protocol helpers and browser island loader.
- Kept as a deep entry so applications can opt into the island runtime without
  pulling it through the default Rue surface.
*/
export {
  RUE_ISLAND_ELEMENT,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  createRueIslandId,
  createIslandContainerHtml,
  deserializeIslandProps,
  escapeIslandAttribute,
  escapeIslandJson,
  hydrateRoot,
  mountRueIsland,
  registerRueIsland,
  serializeIslandProps,
  startRueIslandLoader,
  type HydrateRootOptions,
  type RueIslandClientModule,
  type RueIslandHtmlOptions,
  type RueIslandHydrationStrategy,
  type RueIslandLoaderOptions,
  type RueIslandManifest,
  type RueIslandManifestEntry,
  type RueIslandMountContext,
  type RueRootHandle,
} from '@rue-js/runtime/island'
