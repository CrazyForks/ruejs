import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger data-testid="dialog-trigger">
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">Test Dialog</DialogTitle>
          <DialogDescription data-testid="dialog-description">
            This is a test dialog using Radix UI primitives via ShadCN.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
