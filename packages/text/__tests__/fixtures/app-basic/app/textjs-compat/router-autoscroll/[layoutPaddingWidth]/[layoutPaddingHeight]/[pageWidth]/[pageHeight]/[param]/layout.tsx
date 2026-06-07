type LayoutChildren = unknown

export default async function AutoscrollPositionLayout({
  children,
  params,
}: {
  children: LayoutChildren
  params: Promise<{
    layoutPaddingWidth: string
    layoutPaddingHeight: string
    pageWidth: string
    pageHeight: string
  }>
}) {
  const { layoutPaddingHeight, layoutPaddingWidth, pageWidth, pageHeight } = await params

  return (
    <div
      style={{
        background: 'pink',
        display: 'flex',
        height: Number(pageHeight),
        paddingBottom: Number(layoutPaddingHeight),
        paddingLeft: Number(layoutPaddingWidth),
        paddingRight: Number(layoutPaddingWidth),
        paddingTop: Number(layoutPaddingHeight),
        width: Number(pageWidth),
      }}
    >
      {children}
    </div>
  )
}
