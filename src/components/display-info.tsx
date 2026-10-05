"use client"

import { useEffect, useState } from "react"

/** Temporary: shows how iOS sizes the app, to place the tab bar exactly. */
export function DisplayInfo() {
  const [info, setInfo] = useState("")
  useEffect(() => {
    const probe = document.createElement("div")
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)"
    document.body.appendChild(probe)
    const read = () => {
      const cs = getComputedStyle(probe)
      const standalone =
        (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches
      const vv = window.visualViewport
      const frame = document.querySelector("#app-scroll")?.parentElement?.getBoundingClientRect()
      setInfo(
        [
          standalone ? "app" : "web",
          `screen ${screen.width}×${screen.height}`,
          `inner ${window.innerWidth}×${window.innerHeight}`,
          `doc ${document.documentElement.clientHeight}`,
          `vv ${vv ? Math.round(vv.height) : "-"}`,
          `safe ${parseInt(cs.paddingTop)}/${parseInt(cs.paddingBottom)}`,
          `frame ${frame ? Math.round(frame.height) : "-"}`,
        ].join(" · "),
      )
    }
    read()
    window.addEventListener("resize", read)
    return () => {
      window.removeEventListener("resize", read)
      probe.remove()
    }
  }, [])
  return <p className="num px-1 text-[10px] break-words text-muted-foreground">{info}</p>
}
