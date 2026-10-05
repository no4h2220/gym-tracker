import { readFileSync } from "node:fs"
import { parseLegacyExport } from "../src/lib/legacy.ts"
import { toPoints, personalRecord, plateauInsight, nextTarget } from "../src/lib/stats.ts"
import assert from "node:assert/strict"

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"))
const plan = ["Chest Press","Lat Pulldown","T-Bar Row","Shoulder Press","Lateral Raises","Rear Delt Cable Row","Incline Barbell","Tricep Pushdown","Overhead Tricep Extension","Bicep Curls","Hammer Curls","Leg Press","Hamstring Curl","Leg Extension","Cable Crunches"]
const p = parseLegacyExport(raw, plan)
console.log({ entries: p.entryCount, sets: p.setCount, sessions: p.sessions.length, first: p.firstDate, last: p.lastDate })
console.table(p.exercises.map(e => ({ name: e.name, count: e.count, inPlan: e.inPlan, variants: e.variants.join(" / ") })))
assert.equal(p.entryCount, 361)
assert.equal(p.mergedDuplicates, 1)
assert.equal(p.setCount, 722)
const incline = p.exercises.find(e => e.name === "Incline Barbell")!
assert.equal(incline.count, 14) // 14 raw entries, one date duplicated; assert.ok(incline.inPlan)
const icp = p.exercises.find(e => e.name === "Incline Chest Press")!
assert.equal(icp.inPlan, false); assert.equal(icp.count, 18)
// every entry lands in a session
assert.equal(p.sessions.reduce((n, s) => n + s.entries.length, 0), 361)
// bicep curls stats
const hist = p.sessions.flatMap(s => s.entries.filter(e => e.name === "Bicep Curls").map(e => ({ date: s.date, sets: e.sets.map(x => ({ weight: x.w, reps: x.r })) })))
const pts = toPoints(hist)
const pr = personalRecord(pts)!
console.log("PR", pr, "plateau", plateauInsight(pts))
assert.equal(pr.maxWeight, 35); assert.equal(pr.repsAtMax, 8); assert.equal(pr.date, "2026-07-23")
assert.deepEqual(nextTarget([{weight:35,reps:7},{weight:35,reps:6}], 8, 10), { weight: 35, reps: 8, increase: false })
assert.deepEqual(nextTarget([{weight:35,reps:10},{weight:35,reps:10}], 8, 10), { weight: 37.5, reps: 8, increase: true })
console.log("ALL OK")
