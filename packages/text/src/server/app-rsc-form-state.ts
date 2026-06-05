/**
 * Opaque form-state payload carried by the current RSC compatibility layer.
 *
 * Rue's server-action implementation owns the concrete shape today. Keeping
 * text's server modules on this local type prevents the Rue DOM type from
 * leaking through the app-rendering pipeline while Phase 5 replaces the RSC
 * protocol behind a narrower boundary.
 */
export type AppRscFormState = unknown
