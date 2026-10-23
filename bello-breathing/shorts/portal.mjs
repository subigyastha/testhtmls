// Bello Studio portal: edits the H3 spec live, previews video + sound in sync, exports MP4.
// Video frames come from compose.html (in the iframe), sound stems from audio-core.mjs (in a
// worker), voice clips from server.mjs (Kokoro or your cleaned recordings). The mix you hear is
// built with Web Audio; exports render that same graph offline so the file matches the preview.

import { SAMPLES } from "./samples.mjs"
import { EXERCISES } from "../animation-kit/motion.mjs"
import { SOUND_OPTIONS, SOUND_PRESETS, LAYER_LABEL } from "./sound-catalog.mjs"
import { ROUTINES, ROUTINE_ORDER, PREVIEW_ORDER } from "./routines.mjs"
import { INTRO_NAME, HOOKS, HOOK_TOPICS, fillHook } from "./routine-copy.mjs"

const $ = id => document.getElementById(id)
const STATIC = await fetch("static.json").then(r => r.ok ? r.json() : null).catch(() => null)
const base = SAMPLES["h3-polished"], FPS = base.fps || 30
// Routines come from the Breaks extension (routines.mjs): the same phases, labels and cues. Pace 4/5/6
// stretches every phase ×1, ×1.25, ×1.5 as in the extension (rounded to whole seconds so the count
// stays whole); 4-7-8 keeps its own timing. Box keeps each look's own phase copy.
const routine = () => ROUTINES[state.routine] || ROUTINES.box
function phases() {
  const R = routine(), k = R.fixedPace ? 1 : (+state.phaseSec || 4) / 4, own = state.routine !== "box"
  return R.phases.map(p => ({ role: p.role, seconds: R.fixedPace ? p.seconds : Math.max(1, Math.round(p.seconds * k)),
    ...(own ? { label: p.label, cue: p.cue } : {}), ...(p.to ? { to: p.to } : {}), ...(p.hum ? { hum: true } : {}) }))
}
const cycle = () => phases().reduce((s, p) => s + p.seconds, 0)
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
const LABELS = {
  h3: { in: "Breathe in", hold: "Hold", out: "Breathe out", sip: "Sip in", natural: "Breathe normally" },
  app: { in: "Breathe in", hold: "Hold gently", out: "Breathe out", sip: "A little more in", natural: "Breathe naturally" }   // the app's copy
}
const cap = s => s[0].toUpperCase() + s.slice(1)
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i)

// ---------------------------------------------------------------- state
const defaults = {
  hook: "Is stress bothering you?", hookTopic: "Constipation", guide: "Let me guide you through box breathing.", guideSub: "",
  start: "Let's start.", encourage: "Nice. Keep going.", halfway: "Halfway there.", last: "Last round.",
  outroTitle: "How did that feel?", outroCta: "Save this for your next busy moment.",
  routine: "box", theme: "light", rounds: 4, phaseSec: 4, introPace: 1.25, countUp: true,
  ripple: true, rippleStrength: 1, rippleColor: "201,47,53", progress: true,
  vol: { master: 1, bed: 1, pad: 1, cues: 1, chimes: 1, foley: 1, voice: 1 }, look: "h3",
  palPreset: "look", palBed: "ocean", palCue: "kalimba", palAccent: "bamboo", palPad: "warm", palMark: false, palStroke: "tune",
  voSource: "off", voice: "af_heart", speed: 0.78, voStyle: "meditation", counting: "first", duck: 8, name: "h3-final"
}
// Online, the published preset (the settings the build was made with) replaces the defaults.
// The ocean stem is now "bed" (ocean in H3, air in H4); older presets and saved settings say "ocean".
const migrate = vol => vol && vol.ocean != null && vol.bed == null ? { ...vol, bed: vol.ocean } : vol
if (STATIC?.preset) Object.assign(defaults, STATIC.preset, { vol: { ...defaults.vol, ...migrate(STATIC.preset.vol) } })
let state = structuredClone(defaults)
try { const saved = JSON.parse(localStorage.getItem("bello-portal") || "null"); if (saved) state = { ...state, ...saved, vol: { ...state.vol, ...migrate(saved.vol) } } } catch {}
// The Breaks tune became the default stroke; settings saved on the old default ("single") move to it once.
if (!state.tuneDefault) { if (!state.palStroke || state.palStroke === "single") state.palStroke = "tune"; state.tuneDefault = true }
const save = () => { try { localStorage.setItem("bello-portal", JSON.stringify(state)) } catch {} }
const get = k => k.split(".").reduce((o, p) => o[p], state)
const set = (k, v) => { const p = k.split("."), last = p.pop(); p.reduce((o, q) => o[q], state)[last] = v }

// Look: H3 (paper and serif) or H4 (the app's breathing player). Each has its own base sample.
const app = () => state.look === "app"
const lookBase = () => SAMPLES[app() ? "h4-app" : "h3-polished"]
const LABEL = new Proxy({}, { get: (_, k) => LABELS[app() ? "app" : "h3"][k] })
const LOOK_PRESET = { h3: { rippleColor: "201,47,53", rippleStrength: 1 }, app: { rippleColor: "226,140,118", rippleStrength: 2.4 } }

const roundsText = () => `${cap(WORDS[state.rounds])} rounds`
const guideSub = () => state.guideSub || `${state.rounds} rounds. About ${state.rounds * cycle() < 50 ? "half a minute" : state.rounds * cycle() < 80 ? "a minute" : state.rounds * cycle() < 110 ? "a minute and a half" : "two minutes"}.`
function roundText(r) {
  const R = +state.rounds
  if (r === R - 1) return state.last
  if (R >= 4 && r === R / 2) return state.halfway
  return state.encourage
}

// Intro pace stretches the whole intro (peek, walk, lines) before the routine starts.
const T = x => +(x * (+state.introPace || 1)).toFixed(3)

// ---------------------------------------------------------------- sound palettes
// Options and presets come from sound-catalog.mjs. Like the voice audition, browsing (▶) plays a
// pre-rendered clip and changes nothing; only "Use" changes the mix and rebuilds the sound.
// Using a single option makes the palette "custom"; "look" = the look's own sound.
const PRESET_MAP = Object.fromEntries(SOUND_PRESETS.map(([id, , p]) => [id, p]))
// Stroke (how the cues are played) is kept apart from presets: presets don't change it.
const STATE_KEY = { bed: "palBed", cue: "palCue", accent: "palAccent", pad: "palPad", stroke: "palStroke" }
const lookPalette = () => ({ bed: app() ? "air" : "ocean", cue: "kalimba", accent: "bamboo", pad: "warm", markRounds: false })
const PAL_KEYS = ["palMark"]
function syncControls(keys) {
  for (const k of keys) {
    const el = document.querySelector(`[data-k="${k}"]`)
    if (el) el.type === "checkbox" ? (el.checked = !!state[k]) : (el.value = state[k])
  }
}
function applyPalettePreset() {
  if (state.palPreset === "custom") return
  const p = state.palPreset === "look" ? lookPalette() : PRESET_MAP[state.palPreset] || lookPalette()
  Object.assign(state, { palBed: p.bed, palCue: p.cue, palAccent: p.accent, palPad: p.pad, palMark: !!p.markRounds })
  syncControls(PAL_KEYS)
}
const stroke = () => state.palStroke || "tune"
const paletteOf = () => state.palPreset === "look" ? (stroke() === "tune" ? undefined : { stroke: stroke() })
  : { bed: state.palBed, cue: state.palCue, accent: state.palAccent, pad: state.palPad, markRounds: !!state.palMark, stroke: stroke() }
const optionLabel = (kind, v) => SOUND_OPTIONS[kind].find(o => o[0] === v)?.[1] || v
const presetLabel = id => id === "custom" ? "Custom mix" : SOUND_PRESETS.find(p => p[0] === id)?.[1] || id

// Settle (as in the Breaks extension): he sits (walk + 2.15 s, compose.mjs walkKeys), smiles and
// waves hello (the kit's "welcome" pose), "Let's start." comes during the smile, and the routine
// starts as the smile fades (welcome + 3 s).
// Longer hooks hold the first screen longer (about 0.14 s a character past 24, the length the
// intro was timed for), so the spoken hook ends before the second line and there's time to read it.
const hookX = () => +Math.max(0, (state.hook.trim().length - 24) * 0.14).toFixed(2)
const TH = x => +(T(x) + hookX()).toFixed(3)
const settleAt = () => TH(5.8) + 2.15
function buildSpec() {
  const base = lookBase(), g = settleAt() + 3, R = +state.rounds, C = cycle()
  return {
    ...structuredClone(base), name: state.name.replace(/[^a-z0-9-]/gi, "-") || "h3-final", rounds: R,
    pattern: phases(), countUp: !!state.countUp, theme: state.theme,
    belly: !!routine().belly, humming: phases().some(p => p.hum),
    walk: { ...base.walk, peek: { ...base.walk.peek, in: T(0.7), out: TH(4.2) }, walkFrom: TH(4.5), walk: TH(5.8) },
    welcomeAt: settleAt(), guideAt: g, chimeAt: settleAt() + 1.2,
    progress: state.progress, ripple: state.ripple ? { color: state.rippleColor, strength: +state.rippleStrength } : null,
    breathOutline: false, palette: paletteOf(),
    lines: [
      { from: -1, to: TH(2.4), text: state.hook, y: app() ? 0.3 : 0.33, size: app() ? 100 : 104 },
      { from: TH(2.4), to: TH(4.8), text: state.guide, sub: guideSub(), y: app() ? 0.17 : 0.2, size: 88 },
      { from: settleAt() + 1.2, to: g - 0.1, text: state.start, size: 96 },
      ...range(1, R).map(r => ({ from: g + r * C + 0.2, to: g + r * C + 3.6, text: roundText(r), size: 64, quiet: app() }))
    ],
    // The app's end card keeps "Finished for now" and asks the end-card title under it, over the check-in.
    outro: app() ? { ...base.outro, ask: state.outroTitle, cta: state.outroCta } : { ...base.outro, text: state.outroTitle, cta: state.outroCta }
  }
}

// Voice events: when each line is spoken. Ids match VOICE-SCRIPT-H3.md for recordings.
// Counting follows the on-screen number: up (1 2 3 4) or down (4 3 2 1). The phase name
// is said on the first beat; numbers are quieter so the voice stays soft.
const shortId = { in: "vo-08", hold: "vo-09", out: "vo-10" }
function voEvents(spec) {
  const g = spec.guideAt, R = spec.rounds, C = cycle(), ev = []
  ev.push({ id: "vo-01", at: T(0.3), text: state.hook, kind: "intro" })
  ev.push({ id: "vo-02", at: TH(2.5), text: `${state.guide.replace(/\.$/, "")}… ${roundsText()}.`, kind: "intro" })
  ev.push({ id: "vo-03", at: settleAt() + 1.2, text: state.start, kind: "intro" })
  for (let r = 0; r < R; r++) {
    let at = g + r * C
    phases().forEach((p, k) => {
      const count = state.counting === "all" || (state.counting === "first" && r === 0)
      // Your recordings cover box breathing; other routines' lines are always spoken by the AI voice.
      const cue = { id: state.routine === "box" ? shortId[p.role] || "" : "", at: at + 0.05, text: `${p.label || LABEL[p.role]}…`, kind: "cue" }
      if (count && state.voSource === "recorded" && state.routine === "box") {
        // A whole counted line from the recording; falls back to the short cue if it's longer than the phase.
        ev.push({ id: `vo-0${4 + k}`, at: at + 0.05, text: `${LABEL[p.role]}… ${range(2, p.seconds + 1).map(n => WORDS[n]).join("… ")}.`, maxDur: p.seconds + 0.4, fallback: cue, kind: "cue" })
      } else if (count) {
        ev.push(cue)
        for (let n = 2; n <= p.seconds; n++) {
          const say = state.countUp ? n : p.seconds - n + 1
          ev.push({ id: "", at: at + n - 1 + 0.05, text: `${cap(WORDS[say])}.`, gain: 0.7, kind: "count" })
        }
      } else ev.push(cue)
      at += p.seconds
    })
    if (r >= 1) {
      const text = roundText(r)
      // Placed later by schedule(): in the first quiet gap around the round change.
      ev.push({ id: text === state.last ? "vo-12" : text === state.halfway ? "vo-11" : "vo-14", at: g + r * C, text, kind: "encourage", round: r })
    }
  }
  ev.push({ id: "vo-13", at: g + R * C + 0.3, text: `${app() ? "Finished for now" : "Nice work"}… ${state.outroTitle}`, kind: "outro" })
  return ev
}

// ---------------------------------------------------------------- voice scheduler
// Plans the voice from real clip lengths (or an estimate before a clip exists) so lines never
// talk over each other:
//   cues + end line   fixed on their beats
//   intro lines       in order, each after the previous one finishes (+0.4 s breath)
//   encouragement     first quiet gap that fits, from the previous round's last hold to the
//                     end of this round's first hold; dropped (text only) if none fits
//   counting numbers  dropped where they would overlap anything
const PAD = 0.3
const estimate = text => 0.4 + text.split(/\s+/).length / 2.3 * (0.8 / (+state.speed || 0.8)) * (state.voStyle === "meditation" ? 1.12 : 1)
function schedule(s) {
  const C = cycle(), out = []
  const all = voEvents(s).map(resolve).map(e => ({ ...e, dur: e.missing ? estimate(e.text) : e.dur }))
  const busy = []
  const free = (a, b, pad = PAD) => busy.every(([x, y]) => b + pad <= x || a >= y + pad)
  const take = e => { busy.push([e.at, e.at + e.dur]); out.push(e) }
  // 1. fixed beats
  for (const e of all.filter(e => e.kind === "cue" || e.kind === "outro")) take({ ...e, status: "ok" })
  // 2. intro, in order
  let prevEnd = -1
  for (const e of all.filter(e => e.kind === "intro")) {
    const at = Math.max(e.at, prevEnd + 0.4)
    take({ ...e, at, status: at > e.at + 0.05 ? "moved" : "ok" }); prevEnd = at + e.dur
  }
  // 3. encouragement: scan its window in 0.1 s steps for the earliest gap that fits
  for (const e of all.filter(e => e.kind === "encourage")) {
    const from = e.at - C / 4 + 0.2, to = e.at + C / 2 - 0.2
    let placed = null
    for (let t = from; t + e.dur <= to; t += 0.1) if (free(t, t + e.dur)) { placed = t; break }
    if (placed != null) { take({ ...e, at: placed, status: Math.abs(placed - e.at) > 0.05 ? "moved" : "ok" }); continue }
    // No gap: say it in place of the "Hold…" cue of the quiet hold just before this round
    // (the screen still shows "Hold" and the count).
    const hold = out.find(c => c.kind === "cue" && c.status === "ok" && Math.abs(c.at - (e.at - C / 4 + 0.05)) < 0.01)
    const nextStart = e.at + 0.05 - PAD
    if (hold && hold.at + e.dur <= nextStart) {
      hold.status = "replaced"; busy.splice(busy.findIndex(([x]) => x === hold.at), 1)
      take({ ...e, at: hold.at, status: "moved", note: `said in the hold before round ${e.round + 1}, instead of “Hold…”` })
    } else out.push({ ...e, status: "dropped" })
  }
  // 4. numbers only where there's room
  for (const e of all.filter(e => e.kind === "count")) {
    if (free(e.at, e.at + e.dur, 0.12)) take({ ...e, status: "ok" }); else out.push({ ...e, status: "dropped" })
  }
  out.sort((a, b) => a.at - b.at)
  const start = out.find(e => e.id === "vo-03" && e.kind === "intro")
  const late = start ? start.at + start.dur - (s.guideAt - 0.3) : 0
  return { events: out, late: late > 0 ? late : 0 }
}
let plan = { events: [], late: 0 }

// ---------------------------------------------------------------- controls
// Routine list: the extension's picker order, then the ones awaiting clinical approval.
$("routineSel").innerHTML = [...ROUTINE_ORDER, ...PREVIEW_ORDER].map(id => `<option value="${id}">${ROUTINES[id].name} · ${ROUTINES[id].pattern}${ROUTINES[id].preview ? " (awaiting clinical approval)" : ""}</option>`).join("")
if (!ROUTINES[state.routine]) state.routine = "box"
// Hook picker: fills the Hook text (still editable); "{X} giving you stress?" takes the topic box.
$("hookSel").innerHTML = [...HOOKS.map(h => `<option value="${h}">${h.replace("{X}", "___")}</option>`), `<option value="">Custom (type below)</option>`].join("")
$("hookTopics").innerHTML = HOOK_TOPICS.map(t => `<option value="${t}">`).join("")
const hookTemplate = () => HOOKS.find(h => fillHook(h, state.hookTopic) === state.hook) ?? ""
function syncHookPick() { const h = hookTemplate(); $("hookSel").value = h; $("hookTopicBox").hidden = !h.includes("{X}") }
function pickHook() { const h = $("hookSel").value; if (!h) return syncHookPick(); state.hook = fillHook(h, state.hookTopic); document.querySelector('[data-k="hook"]').value = state.hook; syncHookPick(); save(); refresh({}) }
$("hookSel").addEventListener("input", pickHook)
for (const el of document.querySelectorAll("[data-k]")) {
  const k = el.dataset.k, v = get(k)
  if (el.type === "checkbox") el.checked = v; else el.value = v
  const out = el.nextElementSibling?.tagName === "OUTPUT" ? el.nextElementSibling : null
  const show = () => out && (out.textContent = k === "duck" ? `−${(+el.value).toFixed(1)} dB` : (+el.value).toFixed(2))
  show()
  el.addEventListener("input", () => {
    set(k, el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : k === "countUp" ? el.value === "true" : el.value); show(); save()
    if (k.startsWith("vol.")) return liveGains()
    if (k === "look") { applyLook(); if (state.palPreset === "look") applyPalettePreset(); renderSoundLists(); return refresh({ audio: true }) }
    if (PAL_KEYS.includes(k)) { if (state.palPreset !== "custom") state.palPreset = "custom"; save(); renderSoundLists(); return refresh({ audio: true }) }
    if (k === "routine") { applyRoutine(); return refresh({ audio: true, vo: true }) }
    if (["rounds", "phaseSec", "introPace"].includes(k)) return refresh({ audio: true })
    if (["voSource", "counting", "voice", "speed", "voStyle", "countUp"].includes(k)) { showVoBoxes(); return refresh({ vo: true }) }
    if (k === "hookTopic") { $("hookSel").value = "{X} giving you stress?"; return pickHook() }
    if (k === "hook") syncHookPick()
    if (k === "duck") return
    refresh({})
  })
}
// Switching routine brings its intro line, rounds label and output name.
function applyRoutine() {
  state.guide = `Let me guide you through ${INTRO_NAME[state.routine] || routine().name.toLowerCase()}.`
  state.name = `${app() ? "h4" : "h3"}-${state.routine.replace(/_/g, "-")}`
  for (const el of document.querySelectorAll('[data-k="guide"], [data-k="name"]')) el.value = state[el.dataset.k]
  routineLabels(); save()
}
function routineLabels() {
  const R = routine()
  $("roundsLabel").firstChild.textContent = `Rounds of ${R.name.toLowerCase()} (${R.pattern}) `
  $("paceNote").textContent = R.fixedPace ? "4-7-8 keeps its own timing; pace doesn't apply." : ""
}
// Switching look brings that look's ripple defaults and output name; the controls show them.
function applyLook() {
  Object.assign(state, LOOK_PRESET[app() ? "app" : "h3"])
  state.name = state.name.replace(/^h[34]-/, app() ? "h4-" : "h3-")
  for (const el of document.querySelectorAll("[data-k]")) {
    if (!["rippleColor", "rippleStrength", "name"].includes(el.dataset.k)) continue
    el.value = get(el.dataset.k); el.dispatchEvent(new Event("change"))
    const out = el.nextElementSibling?.tagName === "OUTPUT" ? el.nextElementSibling : null
    if (out) out.textContent = (+el.value).toFixed(2)
  }
  save()
}
function showVoBoxes() { $("aiBox").hidden = state.voSource !== "ai"; $("recBox").hidden = state.voSource !== "recorded" }
showVoBoxes(); routineLabels(); syncHookPick()

// ---------------------------------------------------------------- video preview
const view = $("view")
let spec, frameCount = 0, current = 0
async function viewReady() {
  if (!view.contentWindow?.setup) await new Promise(ok => view.addEventListener("load", ok, { once: true }))
  while (!view.contentWindow.setup) await new Promise(r => setTimeout(r, 50))
  return view.contentWindow
}
async function rebuildVideo() {
  const win = await viewReady()
  spec = buildSpec()
  plan = state.voSource === "off" ? { events: [], late: 0 } : schedule(spec)
  // On-screen lines follow the voice: encouragement shows while it's spoken, "Let's start" with its line.
  for (const e of plan.events) {
    if (e.kind === "encourage" && e.status !== "dropped") Object.assign(spec.lines[2 + e.round], { from: e.at - 0.3, to: e.at + e.dur + 1.4 })
    if (e.id === "vo-03" && e.kind === "intro") Object.assign(spec.lines[2], { from: e.at - 0.1, to: Math.max(spec.lines[2].to, e.at + e.dur + 0.6) })
  }
  frameCount = (await win.setup(spec)).count
  drawFrame(Math.min(current, frameCount - 1))
}
function drawFrame(i) {
  current = i
  view.contentWindow.frame(i, null)
  const t = i / FPS, total = frameCount / FPS
  $("time").textContent = `${t.toFixed(1)} / ${total.toFixed(1)} s`
  if (!playing) $("scrub").value = Math.round(1000 * i / Math.max(1, frameCount - 1))
}
$("scrub").addEventListener("input", e => { stop(); drawFrame(Math.round(e.target.value / 1000 * (frameCount - 1))) })

// ---------------------------------------------------------------- sound
const actx = new AudioContext({ sampleRate: 48000 })
let stems = null, stemsFor = null, live = null
const voClips = new Map()            // text or id → AudioBuffer

function buildStemsAsync(s) {
  return new Promise((ok, fail) => {
    const w = new Worker("audio-worker.mjs", { type: "module" })
    w.onmessage = ({ data }) => {
      const out = {}
      for (const [k, [L, R]] of Object.entries(data.stems)) {
        const b = actx.createBuffer(2, data.N, data.SR); b.copyToChannel(L, 0); b.copyToChannel(R, 1); out[k] = b
      }
      w.terminate(); ok({ buffers: out, duration: data.duration })
    }
    w.onerror = e => { w.terminate(); fail(e) }
    w.postMessage(s)
  })
}

// Key for a clip: AI clips by voice/speed/style/text, recordings by their file id.
const clipKey = e => state.voSource === "ai" ? `ai|${state.voice}|${state.speed}|${state.voStyle}|${e.text}` : `rec|${e.id}`
// Resolves each event to {buffer, start, dur}; a recorded counted line longer than its phase
// falls back to the short phase cue (the on-screen number keeps the count).
function resolve(e) {
  let clip = voClips.get(clipKey(e))
  if (clip && e.maxDur && clip.dur > e.maxDur && e.fallback) { e = { ...e.fallback, tooLong: clip.dur }; clip = voClips.get(clipKey(e)) }
  return clip ? { ...e, ...clip } : { ...e, missing: true }
}
function activeVo() {
  if (state.voSource === "off") return []
  return plan.events.filter(e => !e.missing && e.status !== "dropped" && e.status !== "replaced")
}

// Builds the mix graph on any context (live or offline) starting at `offset` seconds.
function buildGraph(ctx, offset, when) {
  const master = ctx.createGain(); master.gain.value = state.vol.master; master.connect(ctx.destination)
  const duckBus = ctx.createGain(); duckBus.connect(master)
  const gains = {}, sources = []
  const vo = activeVo(), duckTo = Math.pow(10, -state.duck / 20)
  duckBus.gain.setValueAtTime(1, when)
  for (const e of vo.sort((a, b) => a.at - b.at)) {
    const a = when + e.at - offset, b = a + e.dur
    if (b < when) continue
    duckBus.gain.setTargetAtTime(duckTo, Math.max(when, a - 0.25), 0.08)
    duckBus.gain.setTargetAtTime(1, Math.max(when, b + 0.1), 0.3)
  }
  for (const [k, buf] of Object.entries(stems.buffers)) {
    const src = ctx.createBufferSource(), g = ctx.createGain()
    src.buffer = buf; g.gain.value = state.vol[k] ?? 1
    src.connect(g); g.connect(k === "bed" || k === "pad" ? duckBus : master)
    src.start(when, offset); sources.push(src); gains[k] = g
  }
  const voBus = ctx.createGain(), comp = ctx.createDynamicsCompressor()
  Object.assign(comp, {}); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15
  voBus.gain.value = state.vol.voice; voBus.connect(comp); comp.connect(master); gains.voice = voBus
  for (const e of vo) {
    if (e.at + e.dur < offset) continue
    const src = ctx.createBufferSource(), g = ctx.createGain(), skip = Math.max(0, offset - e.at)
    src.buffer = e.buffer; g.gain.value = e.gain ?? 1; src.connect(g); g.connect(voBus)
    src.start(when + Math.max(0, e.at - offset), e.start + skip, Math.max(0.01, e.dur - skip)); sources.push(src)
  }
  gains.master = master
  return { gains, stop: () => sources.forEach(s => { try { s.stop() } catch {} }) }
}
function liveGains() {
  if (!live) return
  for (const [k, g] of Object.entries(live.gains)) g.gain.value = state.vol[k] ?? 1
}

// ---------------------------------------------------------------- transport
let playing = false, startedAt = 0, startOffset = 0
async function play() {
  if (!stems) return
  await actx.resume()
  startOffset = current / FPS
  if (startOffset >= frameCount / FPS - 0.1) startOffset = 0
  startedAt = actx.currentTime + 0.05
  live = buildGraph(actx, startOffset, startedAt)
  playing = true; $("play").textContent = "Pause"
  const tick = () => {
    if (!playing) return
    const i = Math.floor((actx.currentTime - startedAt + startOffset) * FPS)
    if (i >= frameCount) { stop(); drawFrame(frameCount - 1); return }
    drawFrame(Math.max(0, i))
    $("scrub").value = Math.round(1000 * i / Math.max(1, frameCount - 1))
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
function stop() { if (live) live.stop(); live = null; playing = false; $("play").textContent = "Play" }
$("play").addEventListener("click", () => playing ? stop() : play())

// ---------------------------------------------------------------- refresh
let refreshTimer, busy = Promise.resolve()
function refresh({ audio = false, vo = false }) {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { busy = busy.then(() => doRefresh(audio)).catch(e => status(String(e), true)) }, 160)
}
async function doRefresh(audio) {
  const wasPlaying = playing; stop()
  await rebuildVideo()
  const timing = JSON.stringify([spec.rounds, spec.pattern, spec.guideAt, spec.walk, spec.palette, spec.sound])
  if (audio || !stems || stemsFor !== timing) {
    status("Building sound…")
    stems = await buildStemsAsync(spec); stemsFor = timing
  }
  renderVoList()
  const ready = activeVo().length
  const warn = plan.late > 0 ? ` · ⚠ intro voice runs ${plan.late.toFixed(1)} s into the routine: raise Intro pace to about ${((+state.introPace || 1) * (base.guideAt + plan.late + 0.3) / base.guideAt).toFixed(2)}` : ""
  status(`Ready · ${(frameCount / FPS).toFixed(1)} s · ${spec.rounds} rounds` + (state.voSource === "off" ? "" : ` · voice: ${ready} lines planned`) + warn, plan.late > 0)
  $("play").disabled = false; $("export").disabled = false
  if (wasPlaying) play()
}
function status(text, bad = false) { $("status").textContent = text; $("status").className = "status" + (bad ? " bad" : "") }

const MARK = { ok: ["✓", "ok", ""], moved: ["↷", "moved", "moved to fit"], dropped: ["–", "dropped", "no room, shown as text only"], replaced: ["↺", "moved", "replaced by the encouragement line"] }
function renderVoList() {
  const list = $("voList"), line = $("voTimeline")
  if (state.voSource === "off") { list.innerHTML = ""; line.innerHTML = ""; return }
  list.innerHTML = plan.events.map(e => {
    const [icon, cls, why] = e.missing ? ["·", "", "not generated yet"] : MARK[e.status]
    const note = e.tooLong ? `counted line is ${e.tooLong.toFixed(1)} s, longer than the phase: using the short cue` : e.note || why
    return `<div><b>${e.at.toFixed(1)} s</b><span class="${cls}">${icon}</span><span>${state.voSource === "recorded" && e.id ? e.id + " · " : ""}${e.text}${note ? ` <i>(${note})</i>` : ""}</span></div>`
  }).join("")
  // Timeline strip: one block per line, same colours as the list.
  const total = frameCount / FPS || 1
  line.innerHTML = `<div class="tl-guide" style="left:${(100 * spec.guideAt / total).toFixed(2)}%"></div>` + plan.events.map(e =>
    `<span class="tl ${e.missing ? "missing" : e.status} ${e.kind}" title="${e.at.toFixed(1)}–${(e.at + e.dur).toFixed(1)} s · ${e.text.replace(/"/g, "&quot;")}" style="left:${(100 * e.at / total).toFixed(2)}%;width:${Math.max(0.3, 100 * e.dur / total).toFixed(2)}%"></span>`).join("")
}

// ---------------------------------------------------------------- backend
// Locally, server.mjs speaks lines (Kokoro), cleans recordings and exports. On GitHub Pages
// there is no server: static.json (written by publish.mjs) lists pre-generated voice packs
// and pre-cleaned recordings, and export is switched off.
const urlOf = u => STATIC ? new URL(u, location.href).href : u
const api = {
  async voices() { return STATIC ? Object.keys(STATIC.voices) : (await fetch("/api/voices")).json() },
  async tts(voice, text) {
    if (!STATIC) {
      const { clips, error } = await (await fetch("/api/tts", { method: "POST", body: JSON.stringify({ voice, speed: state.speed, style: state.voStyle, lines: [{ id: "x", text }] }) })).json()
      if (error) throw Error(error)
      return clips.x
    }
    const pack = STATIC.voices[voice], url = pack?.clips[text]
    if (!url) throw Error(`“${text}” isn't pre-recorded online for ${voice.split("_")[1]} (edited text needs the local studio)`)
    return urlOf(url)
  },
  async recorded() { return STATIC ? { clips: STATIC.recorded || {}, folder: "online (pre-cleaned)" } : (await fetch("/api/recorded")).json() }
}
if (STATIC) {
  // Online voice packs are made at one speed and style; lock those controls to match.
  const any = Object.values(STATIC.voices)[0]
  if (any) { state.speed = any.speed; state.voStyle = any.style }
  for (const k of ["speed", "voStyle"]) { const el = document.querySelector(`[data-k=${k}]`); if (el) { el.value = state[k]; el.disabled = true } }
  $("genVo").textContent = "Load voice-over"
  $("export").disabled = true
  $("export").closest("section").querySelector(".hint").textContent = "Export runs in the local studio (it renders 1080 × 1920 video on your machine). Online you can preview everything and try settings."
  document.querySelector("header span").textContent = "Online preview · voices are pre-recorded · press Play to hear and see it"
}

// ---------------------------------------------------------------- voice
// Calm, soft-sounding voices listed first in the audition.
const CALM = ["af_heart", "af_nicole", "af_sky", "bf_emma", "bf_isabella", "af_bella", "am_michael", "bm_george", "bm_lewis"]
const ACCENT = { af: "US female", am: "US male", bf: "UK female", bm: "UK male" }
let voiceNames = [], auditionSrc = null

async function loadVoices() {
  try {
    voiceNames = await api.voices()
    voiceNames.sort((a, b) => (CALM.includes(b) - CALM.includes(a)) || (CALM.indexOf(a) - CALM.indexOf(b)) || a.localeCompare(b))
    const sel = document.querySelector("[data-k=voice]")
    sel.innerHTML = voiceNames.map(v => `<option value="${v}">${CALM.includes(v) ? "★ " : ""}${v.split("_")[1]} · ${ACCENT[v.slice(0, 2)] || v.slice(0, 2)}</option>`).join("")
    sel.value = state.voice
    renderAudition()
  } catch { $("voStatus").textContent = "Voice server not reachable" }
}

function renderAudition() {
  $("voiceList").innerHTML = voiceNames.map(v => `
    <div class="voice${v === state.voice ? " chosen" : ""}" data-v="${v}">
      <button data-play="${v}" aria-label="Play ${v}">▶</button>
      <span>${CALM.includes(v) ? "★ " : ""}${v.split("_")[1]} <small>${ACCENT[v.slice(0, 2)] || ""}</small></span>
      <button data-use="${v}">${v === state.voice ? "Chosen" : "Use"}</button>
    </div>`).join("")
}

$("voiceList").addEventListener("click", async e => {
  const play = e.target.closest("[data-play]")?.dataset.play, use = e.target.closest("[data-use]")?.dataset.use
  if (use) {
    state.voice = use; save()
    document.querySelector("[data-k=voice]").value = use
    renderAudition(); refresh({})
    $("voStatus").textContent = `Voice set to ${use.split("_")[1]}. Press "Generate voice-over" to voice the whole video.`
    return
  }
  if (!play) return
  const btn = e.target.closest("button")
  if (auditionSrc) { try { auditionSrc.stop() } catch {} auditionSrc = null }
  stop()
  btn.textContent = "…"; btn.disabled = true
  try {
    const text = $("demoText").value.trim() || "Breathe in…"
    const clipUrl = await api.tts(play, STATIC ? STATIC.voices[play]?.demoText || text : text)
    await actx.resume()
    const src = actx.createBufferSource(), g = actx.createGain()
    src.buffer = await decode(clipUrl); g.gain.value = state.vol.voice
    src.connect(g); g.connect(actx.destination); src.start()
    auditionSrc = src
    src.onended = () => { if (auditionSrc === src) auditionSrc = null; btn.textContent = "▶" }
    btn.textContent = "■"
  } catch (err) { $("voStatus").textContent = String(err.message || err); btn.textContent = "▶" }
  btn.disabled = false
})
document.querySelector("[data-k=voice]").addEventListener("input", () => renderAudition())
async function decode(url) { return actx.decodeAudioData(await (await fetch(url)).arrayBuffer()) }

$("genVo").addEventListener("click", async () => {
  const btn = $("genVo"); btn.disabled = true
  const texts = [...new Set(voEvents(spec).map(e => e.text))]
  const todo = texts.filter(t => !voClips.has(clipKey({ text: t })))
  let skipped = 0
  for (let i = 0; i < todo.length; i++) {
    $("voStatus").textContent = `${STATIC ? "Loading" : "Speaking"} line ${i + 1} of ${todo.length}…`
    try {
      const buffer = await decode(await api.tts(state.voice, todo[i]))
      voClips.set(clipKey({ text: todo[i] }), { buffer, start: 0, dur: buffer.duration })
      renderVoList()
    } catch (e) { skipped++; if (!STATIC) { $("voStatus").textContent = String(e.message || e); break } }
  }
  if (!/rror|reach/.test($("voStatus").textContent)) $("voStatus").textContent = (todo.length ? "Voice ready" : "Already up to date") + (skipped ? ` · ${skipped} edited line(s) aren't pre-recorded online` : "")
  btn.disabled = false; refresh({})
})

$("loadRec").addEventListener("click", async () => {
  $("recStatus").textContent = "Cleaning…"
  try {
    const { clips, folder } = await api.recorded()
    $("recFolder").textContent = folder
    // Each recording is trimmed to its spoken part (first to last detected word).
    for (const [id, c] of Object.entries(clips)) {
      const buffer = await decode(STATIC ? urlOf(c.url) : c.url + "?v=" + Date.now()), seg = c.segments || []
      const start = seg.length ? seg[0][0] : 0, end = seg.length ? seg[seg.length - 1][1] : buffer.duration
      voClips.set(`rec|${id}`, { buffer, start, dur: Math.max(0.1, Math.min(buffer.duration, end) - start) })
    }
    $("recStatus").textContent = Object.keys(clips).length ? `${Object.keys(clips).length} files loaded` : "No files found yet"
  } catch (e) { $("recStatus").textContent = String(e.message || e) }
  refresh({})
})

// ---------------------------------------------------------------- export
function wav(buffer) {
  const n = buffer.length, ch = buffer.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt ")
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buffer.sampleRate, true)
  out.setUint32(28, buffer.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, n * ch * 2, true)
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c))
  // Leave headroom; the server normalises loudness afterwards.
  let peak = 0; for (const d of data) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]))
  const k = peak > 0.9 ? 0.9 / peak : 1
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[c][i] * k)) * 32767, true)
  return out.buffer
}

$("export").addEventListener("click", async () => {
  stop()
  const btn = $("export"), say = t => $("exportStatus").textContent = t
  btn.disabled = true
  try {
    say("Mixing sound…")
    const off = new OfflineAudioContext(2, stems.buffers.bed.length, 48000)
    buildGraph(off, 0, 0)
    const audio = wav(await off.startRendering())
    await fetch(`/api/audio?name=${encodeURIComponent(spec.name)}`, { method: "POST", body: audio })
    const { id } = await (await fetch("/api/export", { method: "POST", body: JSON.stringify({ spec }) })).json()
    for (;;) {
      await new Promise(r => setTimeout(r, 2000))
      const job = await (await fetch(`/api/job?id=${id}`)).json()
      const last = (job.log || []).filter(Boolean).pop() || ""
      if (job.state === "done") { $("exportStatus").innerHTML = `Done · <a href="${job.url}" target="_blank" rel="noopener">${job.url.split("/").pop()}</a>`; break }
      if (job.state === "failed") { say("Export failed: " + last); break }
      say(`${cap(job.state)}… ${last.trim()}`)
    }
  } catch (e) { say("Export failed: " + (e.message || e)) }
  btn.disabled = false
})

// ---------------------------------------------------------------- start
// ---------------------------------------------------------------- sound library (instant previews)
// sound-library.mjs pre-renders a clip of every option and preset, so these play straight away.
const LIB_ROOT = "out/audio/library/"
const LIB = await fetch(LIB_ROOT + "index.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
const libClip = key => LIB[app() ? "h4" : "h3"]?.[key]
const libCache = new Map()
let libSrc = null, libBtn = null
function stopLib() {
  if (libSrc) { try { libSrc.stop() } catch {} }
  if (libBtn) libBtn.textContent = libBtn.dataset.label
  libSrc = libBtn = null
}
async function playLib(rel, btn, label) {
  const same = libBtn === btn
  stopLib(); if (previewSrcs) { previewSrcs.forEach(s => { try { s.stop() } catch {} }); resetPreview() }
  if (same) return                                         // second press stops
  stop(); if (auditionSrc) { try { auditionSrc.stop() } catch {} }
  await actx.resume()
  if (!libCache.has(rel)) libCache.set(rel, await decode(LIB_ROOT + rel))
  const src = actx.createBufferSource(), g = actx.createGain()
  src.buffer = libCache.get(rel); g.gain.value = state.vol.master; src.connect(g); g.connect(actx.destination); src.start()
  libSrc = src; libBtn = btn; btn.dataset.label ||= btn.textContent; btn.textContent = "■"
  src.onended = () => { if (libSrc === src) stopLib() }
  $("palStatus").textContent = `Playing: ${label}`
}
// The lists: presets, then each layer. A row is ▶ (listen, nothing changes) + name + Use.
const LIST_ORDER = [["preset", "Presets"], ...Object.entries(LAYER_LABEL)]
function renderSoundLists() {
  const chosen = { preset: state.palPreset, bed: state.palBed, cue: state.palCue, accent: state.palAccent, pad: state.palPad, stroke: stroke() }
  $("palCurrent").innerHTML = `<b>In use:</b> ${presetLabel(state.palPreset)} · ${["bed", "cue", "stroke", "accent", "pad"].map(k => `${LAYER_LABEL[k].split(" (")[0].toLowerCase()} <i>${optionLabel(k, chosen[k])}</i>`).join(" · ")}${state.palMark ? " · round marks" : ""}`
  for (const [kind, title] of LIST_ORDER) {
    const rows = kind === "preset" ? SOUND_PRESETS.map(([id, label, , flag]) => [id, label, flag]) : SOUND_OPTIONS[kind]
    const box = $(`list-${kind}`)
    box.closest("details").querySelector("summary").innerHTML = `${title} <span>· ${kind === "preset" ? presetLabel(chosen.preset) : optionLabel(kind, chosen[kind])}</span>`
    box.innerHTML = rows.map(([v, label, flag]) => {
      const on = chosen[kind] === v, playable = v !== "none"
      return `<div class="opt${on ? " chosen" : ""}">
        <button data-play="${kind}:${v}" ${playable ? "" : "disabled"} aria-label="Listen to ${label}">▶</button>
        <span>${label}${flag ? ' <small title="Strongly tied to Buddhist or Hindu practice">⚑</small>' : ""}</span>
        <button data-use="${kind}:${v}">${on ? "In use" : "Use"}</button></div>`
    }).join("")
  }
}
$("soundLists").addEventListener("click", e => {
  const play = e.target.closest("[data-play]")?.dataset.play, use = e.target.closest("[data-use]")?.dataset.use
  if (play) {
    // Cues play in the stroke in use; a stroke plays with the cue in use.
    const [kind, v] = play.split(":"), btn = e.target.closest("button")
    const s = kind === "stroke" ? v : stroke(), c = kind === "stroke" ? state.palCue : v
    const rel = kind === "cue" || kind === "stroke" ? libClip(s === "tune" || c === "breaks" ? `cue:${c}` : `cue:${c}@${s}`) : libClip(play)
    if (!rel) { $("palStatus").textContent = "Not in the sound library yet: run node sound-library.mjs"; return }
    const what = kind === "preset" ? presetLabel(v) : kind === "cue" || kind === "stroke" ? `${optionLabel("cue", c)} · ${optionLabel("stroke", s)}` : `${LAYER_LABEL[kind].split(" (")[0]} · ${optionLabel(kind, v)}`
    return playLib(rel, btn, what)
  }
  if (!use) return
  const [kind, v] = use.split(":")
  if (kind === "preset") { state.palPreset = v; applyPalettePreset() }
  else if (kind === "stroke") state.palStroke = v
  else { state[STATE_KEY[kind]] = v; state.palPreset = "custom" }
  save(); renderSoundLists(); refresh({ audio: true })
  $("palStatus").textContent = `Using ${kind === "preset" ? presetLabel(v) : optionLabel(kind, v)}. Rebuilding the sound for the video…`
})

// ---------------------------------------------------------------- palette preview
// A 15-second taste of the current palette: the start moment, one round at 3 s phases, the finish.
// Presets play their pre-rendered clip instantly; a custom mix is built on the spot.
let previewSrcs = null
const resetPreview = () => { previewSrcs = null; $("palPreview").textContent = "▶ Preview 15 s" }
$("palPreview").addEventListener("click", async () => {
  if (previewSrcs) { previewSrcs.forEach(s => { try { s.stop() } catch {} }); resetPreview(); $("palStatus").textContent = ""; return }
  const ready = state.palPreset !== "custom" && stroke() === "tune" && libClip(`preset:${state.palPreset}`)
  if (ready || libBtn === $("palPreview")) return playLib(ready || "", $("palPreview"), `the mix in use (${presetLabel(state.palPreset)})`)
  stopLib(); stop(); if (auditionSrc) { try { auditionSrc.stop() } catch {} }
  $("palPreview").disabled = true; $("palStatus").textContent = "Building the preview (custom mix)…"
  try {
    const sec = Math.min(3, +state.phaseSec || 3), full = buildSpec()
    const mini = { ...full, rounds: 1, guideAt: 1.4, chimeAt: 0.2, walk: null, lines: [],
      pattern: phases().map(p => ({ ...p, seconds: sec })), outro: { ...full.outro, seconds: 4 } }
    const { buffers } = await buildStemsAsync(mini)
    await actx.resume()
    const at = actx.currentTime + 0.05, master = actx.createGain()
    master.gain.value = state.vol.master; master.connect(actx.destination)
    previewSrcs = Object.entries(buffers).map(([k, b]) => {
      const s = actx.createBufferSource(), g = actx.createGain()
      s.buffer = b; g.gain.value = state.vol[k] ?? 1; s.connect(g); g.connect(master); s.start(at); return s
    })
    previewSrcs[0].onended = () => { if (previewSrcs) { resetPreview(); $("palStatus").textContent = "" } }
    $("palPreview").textContent = "■ Stop"
    $("palStatus").textContent = "Playing: the custom mix in use"
  } catch (e) { $("palStatus").textContent = String(e.message || e) }
  $("palPreview").disabled = false
})

if (state.palPreset !== "custom") applyPalettePreset()
renderSoundLists()
loadVoices()
refresh({ audio: true })
// Online: load the pre-recorded voice straight away so the first Play has the voice.
if (STATIC && state.voSource !== "off") (async () => {
  while ($("play").disabled) await new Promise(r => setTimeout(r, 200))
  ;(state.voSource === "recorded" ? $("loadRec") : $("genVo")).click()
})()
