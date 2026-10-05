"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Bottom sheets and the on-screen keyboard.
 *
 * iOS often reports the keyboard late or not at all to the page, so the sheet can't rely on
 * measuring it. Instead, as soon as a text field inside the sheet is focused, the sheet
 * docks to the top of the screen (just under the status bar). The keyboard can then only
 * ever cover the empty space below it. When the visual viewport is known, the sheet is
 * additionally capped to the visible height so long sheets scroll inside.
 */
function useTyping(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [typing, setTyping] = React.useState(false)
  const [visible, setVisible] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!enabled) return
    // listen on the document: the sheet content mounts later than this component
    const inside = (n: EventTarget | null) => n instanceof Node && !!ref.current?.contains(n)
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !/^(checkbox|radio|file|button|submit)$/.test((t as HTMLInputElement).type)))
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target) || !inside(e.target)) return
      setTyping(true)
      const t = e.target as HTMLElement
      setTimeout(() => t.scrollIntoView({ block: "nearest" }), 320)
    }
    const onOut = (e: FocusEvent) => {
      if (!inside(e.target)) return
      if (isField(e.relatedTarget) && inside(e.relatedTarget)) return
      setTyping(false)
    }
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    const vv = window.visualViewport
    const onVV = () => setVisible(vv ? Math.round(vv.height) : null)
    vv?.addEventListener("resize", onVV)
    onVV()
    return () => {
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
      vv?.removeEventListener("resize", onVV)
    }
  }, [ref, enabled])
  return { typing, visible }
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onOpenAutoFocus,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const { typing, visible } = useTyping(contentRef, side === "bottom")
  const docked: React.CSSProperties | undefined =
    side === "bottom" && typing
      ? {
          // never under the status bar / Dynamic Island, even if iOS reports no safe area
          top: "calc(max(env(safe-area-inset-top), 54px) + 10px)",
          bottom: "auto",
          borderRadius: 24,
          maxHeight: visible ? `calc(${visible}px - max(env(safe-area-inset-top), 54px) - 20px)` : "55dvh",
          paddingBottom: 0,
        }
      : undefined
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        ref={contentRef}
        style={docked ? { ...style, ...docked } : style}
        // don't jump into the first input (that pops up the keyboard on phones);
        // focus the sheet itself so screen readers and keyboards still land inside
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e)
          if (e.defaultPrevented) return
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
        }}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 mx-auto h-auto max-h-[88dvh] max-w-[480px] overflow-y-auto overscroll-contain rounded-t-3xl border-t bg-card pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-5" />
            <span className="sr-only">Schliessen</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
