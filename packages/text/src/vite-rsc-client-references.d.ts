declare module 'virtual:text-rsc/client-references' {
  const clientReferences: Record<string, unknown>
  export default clientReferences
  export const clientReferenceMetadata:
    | Record<
        string,
        {
          importId: string
          referenceKey: string
          exportedNames: string[]
        }
      >
    | undefined
}

declare module 'virtual:rue-rsc/client-references' {
  const clientReferences: Record<string, unknown>
  export default clientReferences
  export const clientReferenceMetadata:
    | Record<
        string,
        {
          importId: string
          referenceKey: string
          exportedNames: string[]
        }
      >
    | undefined
}

declare module 'virtual:vite-rsc/client-references' {
  const clientReferences: Record<string, unknown>
  export default clientReferences
  export const clientReferenceMetadata:
    | Record<
        string,
        {
          importId: string
          referenceKey: string
          exportedNames: string[]
        }
      >
    | undefined
}
