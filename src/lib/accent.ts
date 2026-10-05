export const ACCENTS = [
  { id: "volt", hex: "#D7FF3F", de: "Volt", en: "Volt" },
  { id: "cyan", hex: "#3FE0FF", de: "Neon-Cyan", en: "Neon cyan" },
  { id: "blue", hex: "#4D8DFF", de: "Neon-Blau", en: "Neon blue" },
  { id: "pink", hex: "#FF4FD8", de: "Neon-Pink", en: "Neon pink" },
  { id: "orange", hex: "#FF7A2F", de: "Neon-Orange", en: "Neon orange" },
  { id: "green", hex: "#3FFF8B", de: "Neon-Grün", en: "Neon green" },
] as const

export type AccentId = (typeof ACCENTS)[number]["id"]

export function accentHex(id: string | null | undefined): string {
  return ACCENTS.find((a) => a.id === id)?.hex ?? ACCENTS[0].hex
}

export const ACCENT_STORAGE_KEY = "gt-accent"
export const LANG_STORAGE_KEY = "gt-lang"

export function applyAccent(id: string) {
  document.documentElement.style.setProperty("--accent-hex", accentHex(id))
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0F100E")
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
  } catch {}
}

/**
 * Height of the app frame. In an iOS home-screen app the layout viewport can end above
 * the home-indicator area, which leaves an empty strip under the tab bar. There we size
 * the frame to the full screen instead.
 */
export const APP_HEIGHT_SCRIPT = `(function(){function s(){try{var st=(window.navigator.standalone===true)||window.matchMedia("(display-mode: standalone)").matches;var d=document.documentElement;if(!st){d.style.removeProperty("--app-h");return}var p=window.innerHeight>=window.innerWidth;var sh=p?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);d.style.setProperty("--app-h",Math.max(window.innerHeight,sh)+"px")}catch(e){}}s();window.addEventListener("resize",s);window.addEventListener("orientationchange",function(){setTimeout(s,250)});window.addEventListener("pageshow",s)})();`

/** Runs before first paint (inline script in the root layout) so the accent never flashes. */
export const ACCENT_BOOT_SCRIPT = `(function(){try{var m=${JSON.stringify(
  Object.fromEntries(ACCENTS.map((a) => [a.id, a.hex])),
)};var id=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(id&&m[id])document.documentElement.style.setProperty("--accent-hex",m[id]);var l=localStorage.getItem("${LANG_STORAGE_KEY}");if(l==="en"||l==="de")document.documentElement.lang=l;}catch(e){}})();`
