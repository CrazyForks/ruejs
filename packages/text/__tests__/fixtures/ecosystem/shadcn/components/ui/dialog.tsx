import { cn } from '../../lib/utils'

type UiProps = Record<string, unknown> & {
  children?: unknown
  className?: string
}

const Dialog = ({ children }: UiProps) => <div data-rue-dialog-root="">{children}</div>
const DialogPortal = ({ children }: UiProps) => <>{children}</>
const DialogClose = ({ children, className, ...props }: UiProps) => (
  <button className={cn('absolute right-4 top-4 rounded-sm opacity-70', className)} {...props}>
    {children}
  </button>
)
const DialogTrigger = ({ children, className, ...props }: UiProps) => (
  <button aria-haspopup="dialog" className={className} {...props}>
    {children}
  </button>
)

const DialogOverlay = ({ className, ...props }: UiProps) => (
  <div className={cn('fixed inset-0 z-50 bg-black/80', className)} {...props} />
)

const DialogContent = ({ className, children, ...props }: UiProps) => (
  <DialogPortal>
    <DialogOverlay />
    <div
      role="dialog"
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose>
        <span className="sr-only">Close</span>
      </DialogClose>
    </div>
  </DialogPortal>
)

const DialogHeader = ({ className, ...props }: UiProps) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogTitle = ({ className, ...props }: UiProps) => (
  <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
)

const DialogDescription = ({ className, ...props }: UiProps) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
