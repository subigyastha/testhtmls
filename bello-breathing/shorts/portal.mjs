// Bello Studio portal: edits the H3 spec live, previews video + sound in sync, exports MP4.
// Video frames come from compose.html (in the iframe), sound stems from audio-core.mjs (in a
// worker), voice clips from server.mjs (Kokoro or your cleaned recordings). The mix you hear is
// built with Web Audio; exports render that same graph offline so the file matches the preview.

import { SAMPLES } from "./samples.mjs"
import { EXERCISES } from "../animation-kit/motion.mjs"

const $ = id => document.getElementById(id)
const STATIC = await fetch("static.json").then(r => r.ok ? r.json() : null).catch(() => null)
const base = SAMPLES["h3-polished"], FPS = base.fps || 30
const ex = EXERCISES[base.exercise]
const basePhases = ex.roles.map((role, i) => ({ role, seconds: ex.phases[i] })).filter(p => p.seconds > 0)
// Box breathing keeps every side equal, so "seconds per phase" sets all four.
const phases = () => basePhases.map(p => ({ ...p, seconds: +state.phaseSec || p.seconds }))
const cycle = () => phases().reduce((s, p) => s + p.seconds, 0)
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"]
const LABEL = { in: "Breathe in", hold: "Hold", out: "Breathe out", sip: "Sip in", natural: "Breathe normally" }
const cap = s => s[0].toUpperCase() + s.slice(1)
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i)

// ---------------------------------------------------------------- state
const defaults = {
  hook: "Is stress bothering you?", guide: "Let me guide you through box breathing.", guideSub: "",
  start: "Let's start.", encourage: "Nice. Keep going.", halfway: "Halfway there.", last: "Last round.",
  outroTitle: "How did that feel?", outroCta: "Save this for your next busy moment.",
  rounds: 4, phaseSec: 4, introPace: 1.25, countUp: true,
  ripple: true, rippleStrength: 1, rippleColor: "201,47,53", progress: true,
  vol: { master: 1, ocean: 1, pad: 1, cues: 1, chimes: 1, foley: 1, voice: 1 },
  voSource: "off", voice: "af_heart", speed: 0.78, voStyle: "meditation", counting: "first", duck: 8, name: "h3-final"
}
// Online, the published preset (the settings the build was made with) replaces the defaults.
if (STATIC?.preset) Object.assign(defaults, STATIC.preset, { vol: { ...defaults.vol, ...STATIC.preset.vol } })
let state = structuredClone(defaults)
try { const saved = JSON.parse(localStorage.getItem("bello-portal") || "null"); if (saved) state = { ...state, ...saved, vol: { ...state.vol, ...saved.vol } } } catch {}
const save = () => { try { localStorage.setItem("bello-portal", JSON.stringify(state)) } catch {} }
const get = k => k.split(".").reduce((o, p) => o[p], state)
const set = (k, v) => { const p = k.split("."), last = p.pop(); p.reduce((o, q) => o[q], state)[last] = v }

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

function buildSpec() {
  const g = T(base.guideAt), R = +state.rounds, C = cycle()
  return {
    ...structuredClone(base), name: state.name.replace(/[^a-z0-9-]/gi, "-") || "h3-final", rounds: R,
    pattern: phases(), countUp: !!state.countUp,
    walk: { ...base.walk, peek: { ...base.walk.peek, in: T(0.7), out: T(4.2) }, walkFrom: T(4.5), walk: T(5.8) },
    welcomeAt: T(8.0), guideAt: g, chimeAt: T(7.4),
    progress: state.progress, ripple: state.ripple ? { color: state.rippleColor, strength: +state.rippleStrength } : null,
    breathOutline: false,
    lines: [
      { from: -1, to: T(2.4), text: state.hook, y: 0.33, size: 104 },
      { from: T(2.4), to: T(4.8), text: state.guide, sub: guideSub(), y: 0.2, size: 88 },
      { from: T(7.4), to: T(8.9), text: state.start, size: 96 },
      ...range(1, R).map(r => ({ from: g + r * C + 0.2, to: g + r * C + 3.6, text: roundText(r), size: 64 }))
    ],
    outro: { ...base.outro, text: state.outroTitle, cta: state.outroCta }
  }
}

// Voice events: when each line is spoken. Ids match VOICE-SCRIPT-H3.md for recordings.
// Counting follows the on-screen number: up (1 2 3 4) or down (4 3 2 1). The phase name
// is said on the first beat; numbers are quieter so the voice stays soft.
const shortId = { in: "vo-08", hold: "vo-09", out: "vo-10" }
function voEvents(spec) {
  const g = spec.guideAt, R = spec.rounds, C = cycle(), ev = []
  ev.push({ id: "vo-01", at: T(0.3), text: state.hook, kind: "intro" })
  ev.push({ id: "vo-02", at: T(2.5), text: `${state.guide.replace(/\.$/, "")}… ${roundsText()}.`, kind: "intro" })
  ev.push({ id: "vo-03", at: T(7.4), text: state.start, kind: "intro" })
  for (let r = 0; r < R; r++) {
    let at = g + r * C
    phases().forEach((p, k) => {
      const count = state.counting === "all" || (state.counting === "first" && r === 0)
      const cue = { id: shortId[p.role] || "", at: at + 0.05, text: `${LABEL[p.role]}…`, kind: "cue" }
      if (count && state.voSource === "recorded") {
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
  ev.push({ id: "vo-13", at: g + R * C + 0.3, text: `Nice work… ${state.outroTitle}`, kind: "outro" })
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
for (const el of document.querySelectorAll("[data-k]")) {
  const k = el.dataset.k, v = get(k)
  if (el.type === "checkbox") el.checked = v; else el.value = v
  const out = el.nextElementSibling?.tagName === "OUTPUT" ? el.nextElementSibling : null
  const show = () => out && (out.textContent = k === "duck" ? `−${(+el.value).toFixed(1)} dB` : (+el.value).toFixed(2))
  show()
  el.addEventListener("input", () => {
    set(k, el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : k === "countUp" ? el.value === "true" : el.value); show(); save()
    if (k.startsWith("vol.")) return liveGains()
    if (["rounds", "phaseSec", "introPace"].includes(k)) return refresh({ audio: true })
    if (["voSource", "counting", "voice", "speed", "voStyle", "countUp"].includes(k)) { showVoBoxes(); return refresh({ vo: true }) }
    if (k === "duck") return
    refresh({})
  })
}
function showVoBoxes() { $("aiBox").hidden = state.voSource !== "ai"; $("recBox").hidden = state.voSource !== "recorded" }
showVoBoxes()

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
    src.connect(g); g.connect(k === "ocean" || k === "pad" ? duckBus : master)
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
  const timing = JSON.stringify([spec.rounds, spec.pattern, spec.guideAt, spec.walk])
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
    const off = new OfflineAudioContext(2, stems.buffers.ocean.length, 48000)
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
loadVoices()
refresh({ audio: true })
// Online: load the pre-recorded voice straight away so the first Play has the voice.
if (STATIC && state.voSource !== "off") (async () => {
  while ($("play").disabled) await new Promise(r => setTimeout(r, 200))
  ;(state.voSource === "recorded" ? $("loadRec") : $("genVo")).click()
})()
