import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useIsMobile } from "../ui/use-mobile";
import { cn } from "../ui/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Bottom sheet on mobile/tablet, centered dialog on desktop (lg and up).
 * Controlled component only — no built-in trigger. The caller owns the
 * button/link that flips `open` to true, same as every existing sheet
 * in this codebase (editingProfile, editingChildId, etc).
 *
 * Replaces hand-rolled `Dialog.Root` + `fixed bottom-0 ... rounded-t-3xl`
 * markup used across ShareSheet, BookEditSheet, ReaderProfileSheet, etc.
 */
export default function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-card shadow-2xl border-border flex flex-col",
            isMobile
              ? "bottom-0 left-0 right-0 rounded-t-3xl border-t max-h-[90vh]"
              : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border w-full max-w-lg max-h-[85vh]"
          )}
        >
          <div className="flex items-start justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <div>
              <Dialog.Title className="font-display font-bold text-lg">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">{children}</div>

          {footer && (
            <div className="px-5 py-4 border-t border-border flex-shrink-0">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}