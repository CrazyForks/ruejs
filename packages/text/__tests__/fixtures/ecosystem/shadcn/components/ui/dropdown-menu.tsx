import { cn } from '../../lib/utils'

type UiProps = Record<string, unknown> & {
  children?: unknown
  className?: string
  sideOffset?: number
}

const DropdownMenu = ({ children }: UiProps) => <div data-rue-dropdown-root="">{children}</div>
const DropdownMenuGroup = ({ children }: UiProps) => <div role="group">{children}</div>
const DropdownMenuPortal = ({ children }: UiProps) => <>{children}</>
const DropdownMenuTrigger = ({ children, className, ...props }: UiProps) => (
  <button aria-haspopup="menu" className={className} {...props}>
    {children}
  </button>
)

const DropdownMenuContent = ({ className, sideOffset: _sideOffset = 4, ...props }: UiProps) => (
  <DropdownMenuPortal>
    <div
      role="menu"
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    />
  </DropdownMenuPortal>
)

const DropdownMenuItem = ({ className, ...props }: UiProps) => (
  <div
    role="menuitem"
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      className,
    )}
    {...props}
  />
)

const DropdownMenuLabel = ({ className, ...props }: UiProps) => (
  <div className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />
)

const DropdownMenuSeparator = ({ className, ...props }: UiProps) => (
  <div role="separator" className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
)

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
}
