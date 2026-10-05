import { ImageResponse } from "next/og"
import { ACCENTS } from "@/lib/accent"

// Home-screen icon in the user's accent colour: /app-icon/orange?size=180
export function generateStaticParams() {
  return ACCENTS.map((a) => ({ accent: a.id }))
}

export async function GET(req: Request, ctx: { params: Promise<{ accent: string }> }) {
  const { accent } = await ctx.params
  const hex = ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex
  const url = new URL(req.url)
  const size = Math.min(1024, Math.max(48, Number(url.searchParams.get("size")) || 512))
  const maskable = url.searchParams.get("maskable") === "1"
  const w = size * (maskable ? 0.62 : 0.78)
  const bar = w * 0.09
  const plate = { w: w * 0.11, h: w * 0.46 }
  const outer = { w: w * 0.09, h: w * 0.28 }
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0F100E", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: w * 0.6, height: bar, borderRadius: bar / 2, background: hex, left: size / 2 - w * 0.3, top: size / 2 - bar / 2 }} />
        {[-1, 1].map((s) => (
          <div
            key={`p${s}`}
            style={{ position: "absolute", width: plate.w, height: plate.h, borderRadius: plate.w * 0.35, background: hex, left: size / 2 + s * w * 0.3 - plate.w / 2, top: size / 2 - plate.h / 2 }}
          />
        ))}
        {[-1, 1].map((s) => (
          <div
            key={`o${s}`}
            style={{ position: "absolute", width: outer.w, height: outer.h, borderRadius: outer.w * 0.4, background: hex, left: size / 2 + s * w * 0.44 - outer.w / 2, top: size / 2 - outer.h / 2 }}
          />
        ))}
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=31536000, immutable" } },
  )
}
