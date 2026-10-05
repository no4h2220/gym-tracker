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
 * The sheet always stays anchored to the bottom and is lifted with the CSS `translate`
 * property, so every change is one smooth GPU animation (opening the keyboard, closing it,
 * the list getting shorter while typing):
 * - keyboard reported by the visual viewport → the sheet's bottom sits just above it
 *   (this also covers iOS panning the page up while the keyboard is open);
 * - a field is focused but iOS reports no keyboard → the sheet moves up under the status bar,
 *   capped to half the screen, so the keyboard can't cover it;
 * - otherwise → resting position at the bottom.
 */
function useKeyboardLift(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [typing, setTyping] = React.useState(false)
  const [vp, setVp] = React.useState({ top: 0, height: 0, full: 0, safeTop: 0 })
  const [h, setH] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) return
    const inside = (n: EventTarget | null) => n instanceof Node && !!ref.current?.contains(n)
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !/^(checkbox|radio|file|button|submit)$/.test((t as HTMLInputElement).type)))
    const onIn = (e: FocusEvent) => {
      if (isField(e.target) && inside(e.target)) setTyping(true)
    }
    const onOut = (e: FocusEvent) => {
      if (!inside(e.target)) return
      if (isField(e.relatedTarget) && inside(e.relatedTarget)) return
      setTyping(false)
    }
    const probe = document.createElement("div")
    probe.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)"
    document.body.appendChild(probe)
    const vv = window.visualViewport
    let raf = 0
    const read = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() =>
        setVp({
          top: vv ? Math.max(0, vv.offsetTop) : 0,
          height: vv ? vv.height : window.innerHeight,
          full: window.innerHeight,
          safeTop: parseFloat(getComputedStyle(probe).paddingTop) || 0,
        }),
      )
    }
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    vv?.addEventListener("resize", read)
    vv?.addEventListener("scroll", read)
    window.addEventListener("resize", read)
    read()
    return () => {
      cancelAnimationFrame(raf)
      probe.remove()
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
      vv?.removeEventListener("resize", read)
      vv?.removeEventListener("scroll", read)
      window.removeEventListener("resize", read)
    }
  }, [ref, enabled])

  // the sheet's own height (it changes while typing filters a list)
  React.useEffect(() => {
    if (!enabled) return
    let ro: ResizeObserver | null = null
    let tries = 0
    const attach = () => {
      const el = ref.current
      if (!el) {
        if (tries++ < 20) requestAnimationFrame(attach)
        return
      }
      ro = new ResizeObserver(() => setH(el.offsetHeight))
      ro.observe(el)
      setH(el.offsetHeight)
    }
    attach()
    return () => ro?.disconnect()
  }, [ref, enabled, typing])

  if (!enabled || !vp.full) return null
  const keyboard = Math.max(0, vp.full - (vp.top + vp.height))
  const gap = 12
  if (keyboard > 80) {
    const room = vp.height - vp.safeTop - gap * 2
    return { lift: keyboard + gap, maxHeight: room, keyboardOpen: true }
  }
  if (typing) {
    const cap = Math.round(vp.full * 0.5)
    const height = Math.min(h || cap, cap)
    const targetBottom = vp.top + vp.safeTop + gap + height
    return { lift: Math.max(0, vp.full - targetBottom), maxHeight: cap, keyboardOpen: true }
  }
  return { lift: 0, maxHeight: null as number | null, keyboardOpen: false }
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
  const kb = useKeyboardLift(contentRef, side === "bottom")
  const lifted: React.CSSProperties | undefined = kb
    ? {
        translate: `0 ${-kb.lift}px`,
        transition: "translate 300ms cubic-bezier(.2,.8,.2,1), border-radius 300ms, max-height 300ms",
        ...(kb.keyboardOpen ? { borderRadius: 24, paddingBottom: 0 } : null),
        ...(kb.maxHeight ? { maxHeight: kb.maxHeight } : null),
      }
    : undefined
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        ref={contentRef}
        style={lifted ? { ...style, ...lifted } : style}
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
