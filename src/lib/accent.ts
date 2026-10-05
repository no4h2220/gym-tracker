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

export function setIconLinks(id: string) {
  const href = `/app-icon/${id}?size=180`
  let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!link) {
    link = document.createElement("link")
    link.rel = "apple-touch-icon"
    document.head.appendChild(link)
  }
  if (link.getAttribute("href") !== href) link.href = href
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/png"]')
  if (icon) icon.href = `/app-icon/${id}?size=192`
  // the manifest is generated from this cookie, so a new install gets the matching icon
  document.cookie = `gt-accent=${id}; path=/; max-age=31536000; samesite=lax`
}

export function applyAccent(id: string) {
  document.documentElement.style.setProperty("--accent-hex", accentHex(id))
  setIconLinks(id)
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0F100E")
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
  } catch {}
}

/**
 * Some iOS versions give a home-screen app a web view that is shorter than the screen by
 * the top safe area, and don't paint the strip below it. When that's detected the tab bar
 * sits right at the bottom of the web view instead of keeping home-indicator spacing.
 */
export const VIEWPORT_BOOT_SCRIPT = `(function(){function c(){try{var st=navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;var d=document.documentElement;var p=document.createElement("div");p.style.cssText="position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top)";(document.body||d).appendChild(p);var top=parseFloat(getComputedStyle(p).paddingTop)||0;p.remove();var portrait=innerHeight>=innerWidth;var sh=portrait?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);var short=st&&top>0&&Math.abs(innerHeight+top-sh)<=2;if(short)d.setAttribute("data-short-viewport","");else d.removeAttribute("data-short-viewport")}catch(e){}}if(document.body)c();else document.addEventListener("DOMContentLoaded",c);addEventListener("resize",c);addEventListener("pageshow",c)})();`

/** Runs before first paint (inline script in the root layout) so the accent never flashes. */
export const ACCENT_BOOT_SCRIPT = `(function(){try{var m=${JSON.stringify(
  Object.fromEntries(ACCENTS.map((a) => [a.id, a.hex])),
)};var id=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(id&&m[id]){document.documentElement.style.setProperty("--accent-hex",m[id]);document.addEventListener("DOMContentLoaded",function(){var l=document.querySelector('link[rel="apple-touch-icon"]');if(l)l.href="/app-icon/"+id+"?size=180"})}var l=localStorage.getItem("${LANG_STORAGE_KEY}");if(l==="en"||l==="de")document.documentElement.lang=l;}catch(e){}})();`
