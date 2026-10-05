import { readFileSync, writeFileSync } from "node:fs"
import { parseLegacyExport } from "../src/lib/legacy.ts"
const raw = JSON.parse(readFileSync(process.argv[2], "utf8"))
const plan = ["Chest Press","Lat Pulldown","T-Bar Row","Shoulder Press","Lateral Raises","Rear Delt Cable Row","Incline Barbell","Tricep Pushdown","Overhead Tricep Extension","Bicep Curls","Hammer Curls","Leg Press","Hamstring Curl","Leg Extension","Cable Crunches"]
writeFileSync(process.argv[3], JSON.stringify(parseLegacyExport(raw, plan).sessions))
