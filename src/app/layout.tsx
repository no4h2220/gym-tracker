import type { Metadata, Viewport } from "next"
import "@fontsource-variable/archivo/wdth.css"
import "@fontsource-variable/geist-mono/index.css"
import "./globals.css"
import { AppProvider } from "@/components/app-provider"
import { Toaster } from "@/components/ui/sonner"
import { ServiceWorker } from "@/components/service-worker"
import { ACCENT_BOOT_SCRIPT } from "@/lib/accent"

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Trainingsplan, Sätze und Fortschritt – mit Gewicht und Wiederholungen.",
  applicationName: "Gym Tracker",
  appleWebApp: { capable: true, title: "GymTracker", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#0F100E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body>
        <AppProvider>
          {children}
          <Toaster
            position="top-center"
            offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", left: 16, right: 16 }}
          />
        </AppProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
