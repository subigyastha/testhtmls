// Breathing Shorts compositor.
//
// Draws one exact video frame at a time: a background style, the mascot (the
// animation kit's own motion and renderer), the hook text and the breathing
// cues. render.mjs drives it headlessly through window.setup / window.frame.
//
// Two formats:
//   "card"  hook segment (welcome wave + hook text) → guided rounds → finish nod + CTA
//   "loop"  the routine runs from frame 0; the last `blend` seconds ease the rig
//           parameters back into the first frame, so the clip loops seamlessly.

import { bake, EXERCISES } from "../animation-kit/motion.mjs"
import { loadCharacter, drawScene, ART_W, ART_H } from "../animation-kit/renderer.mjs"
import { clamp, ease, mix, warp, ART_SCALE } from "../animation-kit/rig/rig.mjs"

const out = document.getElementById("out"), ctx = out.getContext("2d")
const SERIF = "Fraunces, Georgia, serif", SANS = "'Nunito Sans', 'Segoe UI', sans-serif"
const LABEL = { in: "Breathe in", hold: "Hold", out: "Breathe out", sip: "Sip in a little more", natural: "Breathe normally" }

let spec, frames, phases, cycle, character, W, H

// ---------------------------------------------------------------- timing
const phasesOf = name => {
  const ex = EXERCISES[name]
  if (!ex) throw Error("Unknown exercise " + name)
  return ex.roles.map((role, i) => ({ role, seconds: ex.phases[i] })).filter(p => p.seconds > 0)
}

function phaseAt(local) {
  const round = Math.floor(local / cycle + 1e-9)
  let offset = local - round * cycle, index = 0
  while (index < phases.length - 1 && offset >= phases[index].seconds - 1e-9) { offset -= phases[index].seconds; index++ }
  const phase = phases[index]
  // Counts down (4 3 2 1) by default; spec.countUp shows 1 2 3 4 to match a voice that counts up.
  const count = spec?.countUp ? Math.min(phase.seconds, Math.floor(offset + 1e-6) + 1) : Math.max(1, Math.ceil(phase.seconds - offset - 1e-6))
  return { ...phase, index, offset, round, progress: clamp(offset / phase.seconds), count }
}

const layersOf = p => ({ calm: clamp(p.calm), exhale: clamp(p.exhale || 0), look: clamp(p.look || 0) })

function build(s) {
  const fps = s.fps || 30
  phases = s.pattern ? s.pattern.filter(p => p.seconds > 0) : phasesOf(s.exercise); cycle = phases.reduce((sum, p) => sum + p.seconds, 0)
  if (s.format === "card") {
    const hook = s.hook.seconds, end = hook + s.rounds * cycle, duration = end + s.outro.seconds
    const raw = bake({ set: "breathing", duration, keys: s.keys,
      clips: [{ at: 0, mode: "welcome" }, { at: hook, mode: "guiding", exercise: s.exercise, pattern: s.pattern }, { at: end, mode: "finish" }] }, fps)
    return raw.slice(0, Math.round(duration * fps)).map((f, i) => {
      const t = i / fps
      return { ...f, t, guide: t >= hook && t < end ? t - hook : null, hookEnd: hook, guideEnd: end }
    })
  }
  if (s.format === "story" || s.format === "walkin") {
    // Enter (no app motion) → welcome wave (story only) → hook lines → guided rounds → finish.
    const end = s.guideAt + s.rounds * cycle, duration = end + s.outro.seconds
    const raw = bake({ set: "breathing", duration, keys: s.keys,
      clips: [{ at: 0, mode: "paused" }, ...(s.enter ? [{ at: s.enter.seconds, mode: "welcome" }] : []), ...(s.welcomeAt ? [{ at: s.welcomeAt, mode: "welcome" }] : []), { at: s.guideAt, mode: "guiding", exercise: s.exercise, pattern: s.pattern }, { at: end, mode: "finish" }] }, fps)
    return raw.slice(0, Math.round(duration * fps)).map((f, i) => {
      const t = i / fps
      return { ...f, t, guide: t >= s.guideAt && t < end ? t - s.guideAt : null, hookEnd: s.guideAt, guideEnd: end }
    })
  }
  // Loop: one full pre-roll cycle lets the springs settle and supplies the frames we blend back into.
  const pre = Math.round(cycle * fps), n = Math.round(s.rounds * cycle * fps), d = Math.round((s.blend ?? 1.5) * fps)
  const raw = bake({ set: "breathing", duration: cycle * (s.rounds + 1) + 0.5, keys: s.keys,
    clips: [{ at: 0, mode: "guiding", exercise: s.exercise, pattern: s.pattern }] }, fps)
  const list = []
  for (let i = 0; i < n; i++) {
    const f = raw[i + pre]
    let p = f.p
    if (i >= n - d) {
      const w = ease((i - (n - d) + 1) / d), g = raw[i + pre - n].p
      p = Object.fromEntries(Object.keys(f.p).map(k => [k, mix(f.p[k] || 0, g[k] || 0, w)]))
    }
    list.push({ ...f, p, layers: layersOf(p), t: i / fps, guide: (i + pre) / fps })
  }
  return list
}

// ---------------------------------------------------------------- drawing helpers
function wrap(str, font, maxWidth) {
  ctx.font = font
  const lines = []
  for (const para of String(str).split("\n")) {
    let line = ""
    for (const word of para.split(" ")) {
      const test = line ? line + " " + word : word
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word } else line = test
    }
    lines.push(line)
  }
  return lines
}

// Draws wrapped, centered text with its first baseline at y. Returns the y below the block.
function text(str, y, { font, color, alpha = 1, lineHeight, maxWidth = W - 180, x = W / 2, spacing = "0px", align = "center" }) {
  if (alpha <= 0.001) return y
  const size = parseFloat(font.match(/(\d+)px/)[1]), lh = lineHeight || size * 1.15
  const lines = wrap(str, font, maxWidth)
  ctx.save()
  ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.font = font
  ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.letterSpacing = spacing
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lh))
  ctx.restore()
  return y + lines.length * lh
}

const charRect = (height, centerY) => { const w = height * ART_W / ART_H; return { x: (W - w) / 2, y: centerY - height / 2, w, h: height } }

// Visibility of each layer at frame f.
function visibility(f) {
  if (!["card", "story", "walkin"].includes(spec.format)) return { hook: 1, guide: 1, outro: 0 }
  const t = f.t
  return {
    hook: ease((t - 0.15) / 0.5) * (1 - ease((t - (f.hookEnd - 0.55)) / 0.45)),
    guide: ease((t - f.hookEnd + 0.1) / 0.6) * (1 - ease((t - f.guideEnd + 0.1) / 0.5)),
    outro: ease((t - f.guideEnd - 0.35) / 0.7)
  }
}

// Phase label + count, fading in at each phase change.
function phaseCue(f, y, { labelFont, labelColor, countFont, countColor, alpha }) {
  if (f.guide == null || alpha <= 0) return null
  const ph = phaseAt(f.guide), a = alpha * ease(ph.offset / 0.35), rise = 14 * (1 - ease(ph.offset / 0.35))
  text(LABEL[ph.role], y + rise, { font: labelFont, color: labelColor, alpha: a })
  if (countFont) text(String(ph.count), y + rise + parseFloat(countFont.match(/(\d+)px/)[1]) * 1.25, { font: countFont, color: countColor, alpha: a })
  return ph
}

// ---------------------------------------------------------------- scrolling breath graph
const RAMS = { PAPER: "#F3F2EE", INK: "#232321", GREY: "#8E8C86", HAIR: "#D8D6D0", SIGNAL: "#D9541E", FONT: "Inter, 'Helvetica Neue', Arial, sans-serif" }

// Breath level (0–1) at s seconds into a cycle: the app's curve, smootherstep in and out.
function cycleLevel(s) {
  s = ((s % cycle) + cycle) % cycle
  let level = 0, i = 0
  for (; i < phases.length - 1 && s >= phases[i].seconds; i++) { s -= phases[i].seconds; level = endLevel(phases[i], level) }
  return mix(level, endLevel(phases[i], level), ease(s / phases[i].seconds))
}
const endLevel = (p, level) => p.role === "in" || p.role === "sip" ? 1 : p.role === "out" || p.role === "natural" ? 0 : level

// A full-width strip where the line pans left under the dot, so the dot seems to ride one endless line.
//   anchor: where the dot sits across the width (0.33 shows what's coming, 0.5 centred, 0.8 heart-monitor trail)
//   window: seconds of breath visible across the width
// The pattern repeats every cycle, so panning stays seamless across the video loop.
function scrollGraph(f, { yTop, yBot, anchor = 0.33, window = 10, fade = 0.12, labels = true, lineWidth = 6, dotRadius = 19 }) {
  const { PAPER, INK, HAIR, GREY, SIGNAL, FONT } = RAMS
  const now = f.guide ?? 0, pps = W / window, dotX = W * anchor
  const X = s => dotX + (s - now) * pps, Y = l => yBot - (yBot - yTop) * l
  const from = now - dotX / pps, to = now + (W - dotX) / pps
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"
  ctx.strokeStyle = HAIR; ctx.lineWidth = 2
  for (const y of [yTop, yBot]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  // Ticks each second, taller at phase boundaries; they scroll with the line.
  const bounds = []
  let edge = 0
  for (const p of phases) bounds.push(edge), edge += p.seconds
  for (let s = Math.floor(from); s <= Math.ceil(to); s++) {
    const tall = bounds.includes(((s % cycle) + cycle) % cycle)
    ctx.beginPath(); ctx.moveTo(X(s), yBot + 14); ctx.lineTo(X(s), yBot + (tall ? 44 : 26)); ctx.stroke()
  }
  const path = (a, b) => {
    const n = Math.max(2, Math.ceil((b - a) * 24))
    ctx.beginPath()
    for (let k = 0; k <= n; k++) { const s = a + (b - a) * k / n; k ? ctx.lineTo(X(s), Y(cycleLevel(s))) : ctx.moveTo(X(s), Y(cycleLevel(s))) }
    ctx.stroke()
  }
  ctx.strokeStyle = HAIR; ctx.lineWidth = lineWidth - 1; path(now, to + 0.2)
  ctx.strokeStyle = INK; ctx.lineWidth = lineWidth; path(from - 0.2, now)
  if (labels) {
    // Segment labels centred on each phase as it passes; the current one in ink.
    const current = phaseAt(now)
    for (let c = Math.floor(from / cycle) - 1; c <= Math.ceil(to / cycle); c++) {
      let at = c * cycle
      phases.forEach((p, k) => {
        const mid = X(at + p.seconds / 2), active = c === Math.floor(now / cycle + 1e-9) && k === current.index
        at += p.seconds
        if (mid < -200 || mid > W + 200) return
        text(`${p.role === "natural" ? "REST" : p.role.toUpperCase()} ${p.seconds}`, yBot + 92, { font: `600 26px ${FONT}`, color: active ? INK : GREY, spacing: "3px", x: mid, maxWidth: 400 })
      })
    }
  }
  // Soft fade at both edges so the line enters and leaves rather than being cut.
  for (const [x, dir] of [[0, 1], [W, -1]]) {
    const g = ctx.createLinearGradient(x, 0, x + dir * W * fade, 0)
    g.addColorStop(0, PAPER); g.addColorStop(1, "rgba(243,242,238,0)")
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? 0 : W - W * fade, yTop - 40, W * fade, yBot - yTop + 160)
  }
  const dy = Y(cycleLevel(now))
  ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dotX, dy); ctx.lineTo(dotX, yBot); ctx.stroke()
  ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(dotX, dy, dotRadius + 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = SIGNAL; ctx.beginPath(); ctx.arc(dotX, dy, dotRadius, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// The bold version of the panning graph: no rails, ticks or labels, just a thick line.
// rider "dot" is the orange dot; "cloud" puts the mascot on a small cloud that rides the line.
function lineGraph(f, { yTop, yBot, anchor = 0.33, window = 10, rider = "dot" }) {
  const { PAPER, INK, HAIR, SIGNAL } = RAMS
  const now = f.guide ?? 0, pps = W / window, dotX = W * anchor
  const X = s => dotX + (s - now) * pps, Y = l => yBot - (yBot - yTop) * l
  const from = now - dotX / pps - 0.3, to = now + (W - dotX) / pps + 0.3
  const path = (a, b) => {
    const n = Math.max(2, Math.ceil((b - a) * 30))
    ctx.beginPath()
    for (let k = 0; k <= n; k++) { const s = a + (b - a) * k / n; k ? ctx.lineTo(X(s), Y(cycleLevel(s))) : ctx.moveTo(X(s), Y(cycleLevel(s))) }
    ctx.stroke()
  }
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"
  ctx.strokeStyle = HAIR; ctx.lineWidth = 14; path(now, to)
  ctx.strokeStyle = INK; ctx.lineWidth = 16; path(from, now)
  for (const [x, dir] of [[0, 1], [W, -1]]) {
    const g = ctx.createLinearGradient(x, 0, x + dir * W * 0.1, 0)
    g.addColorStop(0, PAPER); g.addColorStop(1, "rgba(243,242,238,0)")
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? 0 : W * 0.9, yTop - 60, W * 0.1, yBot - yTop + 120)
  }
  const y = Y(cycleLevel(now))
  if (rider === "dot") {
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(dotX, y, 44, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = SIGNAL; ctx.beginPath(); ctx.arc(dotX, y, 34, 0, Math.PI * 2); ctx.fill()
  } else {
    // Lean a little with the slope, as if gliding along the line.
    const slope = (Y(cycleLevel(now + 0.15)) - Y(cycleLevel(now - 0.15))) / (0.3 * pps)
    ctx.translate(dotX, y); ctx.rotate(clamp(Math.atan(slope) * 0.45, -0.16, 0.16))
    const k = spec.riderScale ?? 1, cw = 300 * k
    cloud(0, 0, cw)
    const h = 330 * k, rect = { x: -h * ART_W / ART_H / 2, y: -h * 0.93 - 18 * k, w: h * ART_W / ART_H, h }
    character.render(ctx, f, rect)
    cloudFront(0, 0, cw)
  }
  ctx.restore()
}

// A soft vinyl-toy cloud centred on (x, y), drawn in two passes so he sits *in* it.
const PUFFS = [[-0.36, 0.06, 0.2], [-0.17, -0.1, 0.26], [0.06, -0.14, 0.28], [0.27, -0.06, 0.23], [0.4, 0.08, 0.16], [-0.05, 0.1, 0.26], [0.2, 0.12, 0.2], [-0.25, 0.14, 0.18]]
function puffs(x, y, w, list) {
  ctx.beginPath()
  for (const [px, py, r] of list) { ctx.moveTo(x + px * w + r * w, y + py * w); ctx.arc(x + px * w, y + py * w, r * w, 0, Math.PI * 2) }
}
function cloud(x, y, w) {
  ctx.save()
  ctx.shadowColor = "rgba(60,50,40,0.16)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12
  puffs(x, y, w, PUFFS); ctx.fillStyle = "#FFFFFF"; ctx.fill()
  ctx.restore()
}
function cloudFront(x, y, w) {
  // Front puffs overlap his crossed legs; a faint underside shade gives them volume.
  const front = PUFFS.filter(p => p[1] >= 0.06)
  ctx.save()
  ctx.shadowColor = "rgba(60,50,40,0.10)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = -2
  puffs(x, y + w * 0.02, w, front)
  const g = ctx.createLinearGradient(0, y - w * 0.1, 0, y + w * 0.4)
  g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#E9E6E0")
  ctx.fillStyle = g; ctx.fill()
  ctx.restore()
}

// Centred cue: the count on top, the instruction under it.
function centredCue(f, y) {
  const { INK, GREY, FONT } = RAMS
  if (f.guide == null) return
  const ph = phaseAt(f.guide), a = ease(ph.offset / 0.35), rise = 10 * (1 - a)
  text(String(ph.count), y + rise, { font: `300 150px ${FONT}`, color: INK, alpha: a })
  text(LABEL[ph.role], y + 92 + rise, { font: `500 52px ${FONT}`, color: GREY, alpha: a, spacing: "0.5px" })
}

// Big guide text: phase on the left, count on the right, next phase underneath.
function guideText(f, y, size = 120) {
  const { INK, GREY, FONT } = RAMS, M = 96
  if (f.guide == null) return
  const ph = phaseAt(f.guide), a = ease(ph.offset / 0.35), next = phases[(ph.index + 1) % phases.length]
  text(LABEL[ph.role], y, { x: M, align: "left", maxWidth: W - 2 * M, font: `500 ${size}px ${FONT}`, color: INK, alpha: a, spacing: "-2px" })
  text(String(ph.count), y, { x: W - M, align: "right", font: `300 ${size}px ${FONT}`, color: GREY, alpha: a })
  text(`Next  ${LABEL[next.role]} ${next.seconds}`, y + size * 0.62, { x: M, align: "left", font: `400 34px ${FONT}`, color: GREY, alpha: a })
}

function ramsHook(y) {
  const { INK, GREY, FONT } = RAMS, M = 96, left = { x: M, align: "left", maxWidth: W - 2 * M }
  const below = text(spec.hook.text, y, { ...left, font: `600 76px ${FONT}`, color: INK, spacing: "-1px" })
  return text(spec.hook.sub, below + 4, { ...left, font: `400 36px ${FONT}`, color: GREY })
}

// An outline that follows his silhouette with a gap, widening with the breath.
// Works at half resolution: mask of the current pose → grown twice (outer, inner) → band.
let outlineCanvases
function silhouetteOutline(f, rect, { gap, width, color }) {
  const q = 0.5, w = Math.round(W * q), h = Math.round(H * q)
  outlineCanvases ||= [0, 1].map(() => Object.assign(document.createElement("canvas"), { width: w, height: h }))
  const [mask, band] = outlineCanvases, m = mask.getContext("2d"), b = band.getContext("2d")
  m.clearRect(0, 0, w, h)
  character.render(m, f, { x: rect.x * q, y: rect.y * q, w: rect.w * q, h: rect.h * q })
  // Half of each offset is a hard grow, half a blur re-thresholded at 15% alpha (≈1 sigma out),
  // which rounds the corners and smooths small dips while keeping his overall shape.
  for (const [id, d] of [["grow-outer", (gap + width) * q], ["grow-inner", gap * q]]) {
    document.querySelector(`#${id} feMorphology`).setAttribute("radius", (d * 0.5).toFixed(2))
    document.querySelector(`#${id} feGaussianBlur`).setAttribute("stdDeviation", (d * 0.48).toFixed(2))
  }
  b.clearRect(0, 0, w, h)
  b.filter = "url(#grow-outer)"; b.drawImage(mask, 0, 0)
  b.globalCompositeOperation = "destination-out"; b.filter = "url(#grow-inner)"; b.drawImage(mask, 0, 0)
  b.filter = "none"; b.globalCompositeOperation = "source-in"; b.fillStyle = color; b.fillRect(0, 0, w, h)
  b.globalCompositeOperation = "source-over"
  ctx.save(); ctx.imageSmoothingQuality = "high"; ctx.filter = "blur(1.2px)"; ctx.drawImage(band, 0, 0, W, H); ctx.restore()
}

// Entrance with the current (seated) art: he hops in from the side like a toy,
// leaning into the move, squashing on each landing, then settles into his seat.
function enterCharacter(f, rect) {
  const { seconds, hops = 3, from = 1 } = spec.enter
  const u = clamp(f.t / seconds), travel = 1 - ease(u)
  const phase = u * hops, inAir = Math.sin(Math.PI * (phase % 1)), land = u < 1 ? Math.max(0, 1 - (phase % 1) / 0.18) * (phase > 0.5 ? 1 : 0) : 0
  const settle = Math.sin(Math.PI * clamp((f.t - seconds) / 0.45)) // one soft squash as he sits
  const lift = (u < 1 ? inAir : 0) * rect.h * 0.075 * (1 - 0.35 * u)
  const squash = 0.07 * land + 0.05 * settle, stretch = 0.04 * (u < 1 ? inAir : 0)
  const dx = from * travel * W * 0.95
  const base = { x: rect.x + rect.w / 2 + dx, y: rect.y + rect.h * 0.97 }
  drawScene(ctx, { ...rect, x: rect.x + dx }, f.p.breath || 0)
  ctx.save()
  ctx.translate(base.x, base.y - lift)
  ctx.rotate(-from * 0.09 * travel * (u < 1 ? 1 : 0))
  ctx.scale(1 + squash - stretch * 0.5, 1 - squash + stretch)
  ctx.translate(-base.x, -base.y)
  character.render(ctx, f, { ...rect, x: rect.x + dx })
  ctx.restore()
}

// ---------------------------------------------------------------- walk-in sprites
// New standing/walking/waving/sitting art (Gutsphere-Bello-Walk-In-Frames-v1). The frames come
// from separate generations on different canvases, so each one is registered by its head:
// skull radius (fitted from the crown, ignoring ears and a raised hand) and the ground line.
const SPRITE_DIR = "../animation-kit/Gutsphere-Bello-Walk-In-Frames-v2/shorts/art/new/"
const SPRITE_FILES = {
  stand: "01-stand-front.webp", turn: "03-turn.webp", caring: "06-caring-face.webp",
  walkStop: "02-walk-stop.webp", sit4: "05-sit-4.webp", peek1: "07-peek-1.webp", peek2: "07-peek-2.webp", peek3: "07-peek-3.webp",
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [`walk${n}`, `02-walk-${n}.webp`])),
  wave: ["04-wave-sheet.webp", 3], sit: ["05-sit-sheet.webp", 3]
}
let sprites, kitHead

function measure(img, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const c = Object.assign(document.createElement("canvas"), { width: sw, height: sh }), x = c.getContext("2d")
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const a = x.getImageData(0, 0, sw, sh).data, solid = (i, j) => a[(j * sw + i) * 4 + 3] > 128
  let top = -1, bottom = -1, topX = 0
  for (let j = 0; j < sh && top < 0; j++) { let n = 0, sum = 0; for (let i = 0; i < sw; i++) if (solid(i, j)) { n++; sum += i } if (n > 3) { top = j; topX = sum / n } }
  for (let j = sh - 1; j >= 0 && bottom < 0; j--) for (let i = 0; i < sw; i++) if (solid(i, j)) { bottom = j; break }
  // Width of the opaque run through the crown's column at depth d below the top.
  const run = d => {
    const j = Math.round(top + d), c0 = Math.round(topX)
    if (!solid(c0, j)) return [c0, c0]
    let l = c0, r = c0
    while (l > 0 && solid(l - 1, j)) l--
    while (r < sw - 1 && solid(r + 1, j)) r++
    return [l, r]
  }
  // Circle through the crown: R = (w²/4 + d²) / 2d, sampled at d ≈ 0.35 R (above ears and hands).
  let R = (bottom - top) * 0.15
  for (let k = 0; k < 8; k++) { const d = Math.max(6, 0.35 * R), [l, r] = run(d), w = r - l; R = (w * w / 4 + d * d) / (2 * d) }
  const [l, r] = run(0.35 * R)
  return { img, sx, sy, sw, sh, R, headX: (l + r) / 2, top, bottom, reach: top }
}

function sheetCuts(img, cells) {
  const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }), x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const a = x.getImageData(0, 0, img.width, img.height).data, cols = new Array(img.width).fill(0)
  for (let j = 0; j < img.height; j += 2) for (let i = 0; i < img.width; i++) if (a[(j * img.width + i) * 4 + 3] > 40) cols[i]++
  const cuts = [0], cw = img.width / cells
  for (let k = 1; k < cells; k++) {
    let best = Math.round(k * cw)
    for (let i = Math.round(k * cw - cw * 0.2); i <= Math.round(k * cw + cw * 0.2); i++) if (cols[i] < cols[best]) best = i
    cuts.push(best)
  }
  return cuts.concat(img.width)
}

// Copies the cell into its own canvas holding only the opaque region connected to the crown.
function isolate(s) {
  const c = Object.assign(document.createElement("canvas"), { width: s.sw, height: s.sh }), x = c.getContext("2d")
  x.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, 0, 0, s.sw, s.sh)
  const im = x.getImageData(0, 0, s.sw, s.sh), a = im.data, seen = new Uint8Array(s.sw * s.sh)
  const stack = [s.top * s.sw + Math.round(s.headX)]
  while (stack.length) {
    const p = stack.pop()
    if (seen[p] || a[p * 4 + 3] < 8) continue
    seen[p] = 1
    const i = p % s.sw, j = (p - i) / s.sw
    if (i > 0) stack.push(p - 1); if (i < s.sw - 1) stack.push(p + 1); if (j > 0) stack.push(p - s.sw); if (j < s.sh - 1) stack.push(p + s.sw)
  }
  for (let p = 0; p < seen.length; p++) if (!seen[p]) a[p * 4 + 3] = 0
  x.putImageData(im, 0, 0)
  return { ...s, img: c, sx: 0, sy: 0 }
}

async function loadSprites() {
  const load = src => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(Error("Missing " + src)); i.src = src })
  sprites = {}
  for (const [name, file] of Object.entries(SPRITE_FILES)) {
    const [path, cells] = Array.isArray(file) ? file : [file, 1], img = await load(SPRITE_DIR + path)
    if (cells === 1) { sprites[name] = measure(img); continue }
    // Split the sheet at the emptiest column near each third, then keep only the figure
    // connected to the cell's crown so a neighbour's robe can't leak in.
    const cuts = sheetCuts(img, cells)
    for (let k = 0; k < cells; k++) sprites[`${name}${k + 1}`] = isolate(measure(img, cuts[k], 0, cuts[k + 1] - cuts[k], img.height))
  }
  kitHead = measure(await load("../animation-kit/art/expressions/buddha-hd-calm.webp"))
}

// The seated rect is sized so that, at the same head size, his *tallest* standing pose
// (including the raised waving hand) stays below the text block.
function walkRect() {
  const groundY = H * 0.875, topLimit = H * 0.37
  const tallest = Math.max(...["stand", "turn", "wave1", "wave2", "wave3"].map(n => (sprites[n].bottom - Math.min(sprites[n].top, sprites[n].reach)) / sprites[n].R))
  const headR = (groundY - topLimit) / tallest
  const rectW = headR / (kitHead.R / ART_W * ART_SCALE), rectH = rectW * ART_H / ART_W
  const kitGround = 0.5 + (kitHead.bottom / ART_H - 0.5) * ART_SCALE
  return { x: (W - rectW) / 2, y: groundY - rectH * kitGround, w: rectW, h: rectH, headR, groundY }
}

// ---- poses: every sprite plus "kit" (the app's seated character) and "caring" (face swap on kit)
let blendCanvas, maskCanvas
const layer = () => (blendCanvas ||= Object.assign(document.createElement("canvas"), { width: W, height: H }))

function poseHeight(name, rect) {
  if (name === "kit" || name === "caring") return (kitHead.bottom - kitHead.top) / ART_H * rect.h * ART_SCALE
  const s = sprites[name]; return (s.bottom - s.top) * rect.headR / s.R
}

// Draws one pose with its feet on the ground at x, scaled vertically by sy around the ground.
function drawPose(c, name, f, rect, x, alpha, sy = 1) {
  if (alpha <= 0.001) return
  c.save(); c.globalAlpha = clamp(alpha)
  c.translate(x, rect.groundY); c.scale(1, sy); c.translate(-x, -rect.groundY)
  if (name === "kit" || name === "caring") {
    const r = { ...rect, x: rect.x + (x - W / 2) }
    character.render(c, f, r)
    if (name === "caring") drawCaringFace(c, r)
  } else {
    const s = sprites[name], k = rect.headR / s.R
    if (spec.mirror && name !== "sit4") { c.translate(x, 0); c.scale(-1, 1); c.translate(-x, 0) }
    c.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, x - s.headX * k, rect.groundY - s.bottom * k, s.sw * k, s.sh * k)
  }
  c.restore()
}

// The caring expression, registered to the kit's head (crown + skull radius), shown only
// inside a soft oval around the face so the body underneath stays the app's own art.
function drawCaringFace(c, r) {
  const s = sprites.caring, kitR = kitHead.R / ART_W * r.w * ART_SCALE, k = kitR / s.R
  const crownX = r.x + r.w * (0.5 + (kitHead.headX / ART_W - 0.5) * ART_SCALE)
  const crownY = r.y + r.h * (0.5 + (kitHead.top / ART_H - 0.5) * ART_SCALE)
  const m = (maskCanvas ||= Object.assign(document.createElement("canvas"), { width: W, height: H })), mc = m.getContext("2d")
  mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, W, H)
  mc.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, crownX - s.headX * k, crownY - s.top * k, s.sw * k, s.sh * k)
  const cx = crownX, cy = crownY + kitR * 1.15, g = mc.createRadialGradient(cx, cy, kitR * 0.55, cx, cy, kitR * 0.95)
  g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)")
  mc.globalCompositeOperation = "destination-in"; mc.fillStyle = g; mc.fillRect(0, 0, W, H); mc.globalCompositeOperation = "source-over"
  c.drawImage(m, 0, 0)
}

// Cross-dissolve A → B (premultiplied, so no see-through dip), with each pose stretching
// toward the other's height so size changes read as motion rather than a pop.
function morph(a, b, m, f, rect, x, { lift = 0, tilt = 0, squash = 0 } = {}) {
  const ha = poseHeight(a, rect), hb = poseHeight(b, rect), ratio = clamp(hb / ha, 0.62, 1.6)
  const c = layer().getContext("2d")
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H)
  c.translate(x, rect.groundY - lift); c.rotate(tilt); c.scale(1 + squash * 0.6, 1 - squash); c.translate(-x, -rect.groundY)
  const faceSwap = [a, b].includes("caring") && [a, b].includes("kit")
  if (faceSwap) {
    // Same body: draw it once, then fade the caring face over it (no additive blend).
    const care = a === "caring" ? 1 - m : m, r = { ...rect, x: rect.x + (x - W / 2) }
    character.render(c, f, r)
    c.save(); c.globalAlpha = care; drawCaringFace(c, r); c.restore()
  } else if (a === b || m <= 0.001) drawPose(c, a, f, rect, x, 1)
  else if (m >= 0.999) drawPose(c, b, f, rect, x, 1)
  else {
    drawPose(c, a, f, rect, x, 1 - m, mix(1, ratio, m))
    c.globalCompositeOperation = "lighter"
    drawPose(c, b, f, rect, x, m, mix(1 / ratio, 1, m))
    c.globalCompositeOperation = "source-over"
  }
  ctx.drawImage(layer(), 0, 0)
}

// Pose keys after the walk: [time, pose]. Between two keys the first dissolves into the second.
function walkKeys() {
  const T = spec.walk
  if (T.peek) {
    // Peek version: straight from the walk into a quick turn, then sit down directly.
    // walk → stop (feet together) → turn → sit 1–3 → sit 4 (edited from the app art) → the app character
    const w = T.walk, s = w + 0.65
    return [[w, "walk1"], [w + 0.22, "walkStop"], [w + 0.32, "walkStop"], [w + 0.55, "turn"], [s, "turn"],
      [s + 0.3, "sit1"], [s + 0.6, "sit2"], [s + 0.9, "sit3"], [s + 1.2, "sit4"], [s + 1.5, "kit"]]
  }
  const keys = [[T.walk, "walk1"], [T.walk + 0.35, "turn"], [T.turn, "turn"], [T.turn + 0.2, "wave1"]]
  const swing = ["wave2", "wave3", "wave2", "wave1"]
  let t = T.turn + 0.2, i = 0
  while (t + 0.17 <= T.wave - 0.1) { t += 0.17; keys.push([t, swing[i++ % 4]]) }
  if (keys[keys.length - 1][1] !== "wave1") keys.push([t + 0.17, "wave1"])
  const after = keys[keys.length - 1][0]
  keys.push([after + 0.3, "stand"])
  const sit = Math.max(T.sit, after + 0.45)
  keys.push([sit, "stand"], [sit + 0.32, "sit1"], [sit + 0.64, "sit2"], [sit + 0.96, "sit3"], [sit + 1.3, "kit"])
  if (T.caring) {
    const [on, off] = T.caring
    keys.push([on, "kit"], [on + 0.45, "caring"], [off, "caring"], [off + 0.45, "kit"])
  }
  return keys
}
let walkTrack

// Before the walk: an empty stage, or Bello peeking in from the right edge, leaning so only
// his head and waving arm come into view (the body stays off screen), then ducking back out.
function peek(f, rect) {
  const P = spec.walk.peek, t = f.t
  if (!P || t < P.in || t > P.out + 0.5) return
  const k = ease((t - P.in) / 0.6) * (1 - ease((t - P.out) / 0.5))
  if (P.art) {
    // Dedicated peek art, already cut off by its right edge: pin that edge to the screen edge,
    // slide it in, and swing the waving hand between the two frames.
    const s = Math.max(0, t - P.in - 0.35) / 0.2, i = Math.floor(s), seq = ["peek1", "peek2", "peek3", "peek2"]
    const p = sprites.peek1, kk = rect.headR / p.R, inset = (p.sw - p.headX) * kk, slide = (1 - k) * p.sw * kk * 0.75
    const x = spec.mirror ? -30 + inset - slide : W + 30 - inset + slide
    morph(seq[i % 4], seq[(i + 1) % 4], ease(s - i), f, rect, x, { tilt: (spec.mirror ? 1 : -1) * (P.angle || 0) * k, lift: -rect.headR * (P.drop || 0) })
    return
  }
  const s = Math.max(0, t - P.in - 0.35) / 0.17, seq = ["wave1", "wave2", "wave3", "wave2"], i = Math.floor(s)
  morph(seq[i % 4], seq[(i + 1) % 4], ease(s - i), f, rect, W + rect.headR * (P.offset + 3 * (1 - k)), { tilt: -P.angle * k, lift: -rect.headR * (P.drop || 0) })
}

// A's circle behind him (same centre as the app's stage halo), growing with the breath, and a
// soft ripple that leaves it at every phase change and fades as it spreads.
function breathRipple(f, rect) {
  const o = { color: "201,47,53", strength: 1, ...spec.ripple }
  const b = f.p.breath || 0, fadeIn = ease(f.guide / 1.2) * o.strength
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * 0.08 + rect.w * 0.36, r0 = rect.w * 0.36
  const r = r0 * (0.94 + 0.16 * b)
  ctx.save()
  const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
  g.addColorStop(0, `rgba(${o.color},${0.05 * fadeIn})`); g.addColorStop(1, `rgba(${o.color},0)`)
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill()
  ctx.lineWidth = 6; ctx.strokeStyle = `rgba(${o.color},${(0.14 + 0.12 * b) * fadeIn})`
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke()
  // Ripples: one per phase start in the last 3.2 s.
  let edge = 0
  const starts = phases.map(p => (edge += p.seconds) - p.seconds)
  const now = f.guide, c0 = Math.floor(now / cycle)
  for (let c = c0 - 1; c <= c0; c++) for (const s of starts) {
    const age = now - (c * cycle + s)
    if (age < 0 || age > 3.2 || c * cycle + s < 0) continue
    const p = age / 3.2, rr = r * (1 + 0.55 * ease(p))
    ctx.lineWidth = 4 * (1 - p) + 1; ctx.strokeStyle = `rgba(${o.color},${0.22 * (1 - p) ** 1.5 * fadeIn})`
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke()
  }
  ctx.restore()
}
const TAU = Math.PI * 2

// Walk in from the right (waddle loop 1→3→6→3), turn, wave, then the pose keys above.
function walkIn(f, rect) {
  const T = spec.walk, t = f.t, cx = W / 2
  walkTrack ||= walkKeys()
  let x = cx, opts = {}, a, b, m = 0
  const from = T.walkFrom ?? 0
  if (t < from) { peek(f, rect); return }
  if (t < T.walk) {
    const u = (t - from) / (T.walk - from), start = W * 0.8, travel = 1 - (1 - u) ** 2.2
    x = cx + (spec.mirror ? -1 : 1) * start * (1 - travel)
    // A whole number of waddle cycles, so the walk ends exactly on pose 1.
    const seq = T.steps || ["walk1", "walk3", "walk6", "walk3"], n = seq.length, bobEvery = T.steps ? n / 2 : n
    const cycles = Math.max(1, Math.round(start / (W * 0.19 * n / 4))), s = travel * cycles * n
    const i = Math.floor(s), frac = s - i
    a = seq[i % n]; b = seq[(i + 1) % n]; m = ease(clamp((frac - 0.25) / 0.5))
    opts = { lift: Math.sin(Math.PI * s / bobEvery) ** 2 * rect.headR * 0.09 * (1 - u * 0.5), tilt: 0.035 * Math.sin(2 * Math.PI * s / n) * (1 - u * 0.6) }
  } else {
    const keys = walkTrack
    let k = 0
    while (k < keys.length - 1 && t >= keys[k + 1][0]) k++
    a = keys[k][1]; b = keys[Math.min(k + 1, keys.length - 1)][1]
    // Hold – quick blend – hold: a short dissolve centred in the interval reads as motion,
    // a long one as a double exposure. Wave swings (hand only) and the face swap blend fully.
    const span = k >= keys.length - 1 ? 1 : keys[k + 1][0] - keys[k][0], u = (t - keys[k][0]) / span
    const soft = (a.startsWith("wave") && b.startsWith("wave")) || [a, b].includes("caring")
    const w = soft ? 1 : Math.min(1, 0.15 / span)
    m = k >= keys.length - 1 ? 0 : ease(clamp((u - (1 - w) / 2) / w))
    // A slow breath while he stands or sits still (before the app motion takes over).
    const still = (a === b) && (a === "stand" || a === "kit" || a === "caring") && t < spec.guideAt
    if (still) opts.squash = 0.007 * Math.sin((t - keys[k][0]) * Math.PI * 2 / 3.4)
  }
  const seated = a === "kit" && b === "kit"
  drawScene(ctx, { ...rect, x: rect.x + (x - cx) }, seated ? f.p.breath || 0 : 0)
  if (seated && spec.breathOutline && f.guide != null) {
    const fadeIn = ease(f.guide / 1.2), b = f.p.breath || 0
    silhouetteOutline(f, rect, { gap: 24 + 46 * b, width: 8, color: `rgba(201,47,53,${(0.16 + 0.2 * b) * fadeIn})` })
  }
  if (seated && spec.ripple && f.guide != null) breathRipple(f, rect)
  if (seated && !opts.squash) character.render(ctx, f, rect)
  else morph(a, b, m, f, rect, x, opts)
}

// ---------------------------------------------------------------- styles
const STYLES = {
  // The app's own stage: warm paper, faint halo and ground shadow, quiet type.
  minimal(f, v) {
    ctx.fillStyle = "#EFECE6"; ctx.fillRect(0, 0, W, H)
    const vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.75)
    vignette.addColorStop(0, "rgba(255,255,255,0.35)"); vignette.addColorStop(1, "rgba(120,100,80,0.10)")
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H)
    const rect = spec.format === "walkin" ? walkRect() : charRect(H * 0.43, H * 0.66)
    const ink = "#2B2622", muted = "#8A8178", red = "#C92F35"
    if (spec.progress) {
      const total = frames.length / (spec.fps || 30), bx = 96, bw = W - 192, by = H * 0.038
      ctx.fillStyle = "rgba(43,38,34,0.10)"; ctx.fillRect(bx, by, bw, 6)
      ctx.fillStyle = "rgba(201,47,53,0.75)"; ctx.fillRect(bx, by, bw * clamp(f.t / total), 6)
    }
    if (spec.format === "story" || spec.format === "walkin") {
      if (spec.format === "walkin") walkIn(f, rect); else enterCharacter(f, rect)
      // Hook lines replace each other in turn.
      for (const line of spec.lines) {
        const a = ease((f.t - line.from) / 0.45) * (1 - ease((f.t - line.to + 0.4) / 0.4)), rise = 18 * (1 - ease((f.t - line.from) / 0.45))
        const y = text(line.text, (line.y ? H * line.y : spec.format === "walkin" ? H * 0.135 : H * 0.21) + rise, { font: `600 ${line.size || (spec.format === "walkin" ? 84 : 100)}px ${SERIF}`, color: ink, alpha: a, maxWidth: spec.format === "walkin" ? W - 110 : W - 180 })
        if (line.sub) text(line.sub, y + 26 + rise, { font: `600 46px ${SANS}`, color: muted, alpha: a, maxWidth: W - 260 })
      }
    } else {
      drawScene(ctx, rect, f.p.breath || 0)
      character.render(ctx, f, rect)
    }

    // Hook: big and centered in the card format, fixed at the top in the loop format.
    if (spec.format === "story" || spec.format === "walkin") {
      // drawn above
    } else if (spec.format === "card") {
      const y = text(spec.hook.text, H * 0.21, { font: `600 104px ${SERIF}`, color: ink, alpha: v.hook })
      text(spec.hook.sub, y + 30, { font: `600 46px ${SANS}`, color: muted, alpha: v.hook, maxWidth: W - 260 })
    } else {
      const y = text(spec.hook.text, H * 0.14, { font: `600 80px ${SERIF}`, color: ink })
      text(spec.hook.sub, y + 10, { font: `600 40px ${SANS}`, color: muted, maxWidth: W - 260 })
    }
    const ph = phaseCue(f, H * 0.33, { labelFont: `600 88px ${SERIF}`, labelColor: ink, countFont: `400 72px ${SANS}`, countColor: red, alpha: v.guide })
    if (ph) {
      // Thin bar that fills over the phase.
      const bw = 360, bx = (W - bw) / 2, by = H * 0.33 + 150
      ctx.save(); ctx.globalAlpha = v.guide; ctx.lineCap = "round"; ctx.lineWidth = 8
      ctx.strokeStyle = "rgba(43,38,34,0.12)"; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke()
      ctx.strokeStyle = red; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw * Math.max(0.001, ph.progress), by); ctx.stroke()
      ctx.restore()
      if (spec.format !== "loop") text(`Round ${Math.min(ph.round + 1, spec.rounds)} of ${spec.rounds}`, by + 70, { font: `600 34px ${SANS}`, color: muted, alpha: v.guide, spacing: "1px" })
    }
    if (v.outro > 0) {
      const y = text(spec.outro.text, H * 0.2, { font: `600 104px ${SERIF}`, color: ink, alpha: v.outro })
      text(spec.outro.cta, y + 24, { font: `600 46px ${SANS}`, color: muted, alpha: v.outro, maxWidth: W - 260 })
      text("gutsphere", H * (spec.format === "walkin" ? 0.94 : 0.895), { font: `800 44px ${SANS}`, color: red, alpha: v.outro, spacing: "2px" })
    }
  },

  // Box breathing made literal: a dot travels one side of the square per phase.
  tracer(f, v) {
    ctx.fillStyle = "#F6F1E9"; ctx.fillRect(0, 0, W, H)
    const side = W * 0.8, cx = W / 2, cy = H * 0.6, x0 = cx - side / 2, y0 = cy - side / 2
    const corners = [[x0, y0 + side], [x0, y0], [x0 + side, y0], [x0 + side, y0 + side]] // bottom-left, then clockwise
    const ph = f.guide != null ? phaseAt(f.guide) : null
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"
    ctx.strokeStyle = "#E3D8C8"; ctx.lineWidth = 12
    ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke()
    let dot = corners[0]
    if (ph) {
      ctx.strokeStyle = "#C92F35"; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(...corners[0])
      for (let k = 0; k < ph.index; k++) ctx.lineTo(...corners[(k + 1) % 4])
      const [ax, ay] = corners[ph.index % 4], [bx, by] = corners[(ph.index + 1) % 4]
      dot = [mix(ax, bx, ph.progress), mix(ay, by, ph.progress)]
      ctx.lineTo(...dot); ctx.stroke()
    }
    const glow = ctx.createRadialGradient(dot[0], dot[1], 0, dot[0], dot[1], 70)
    glow.addColorStop(0, "rgba(201,47,53,0.35)"); glow.addColorStop(1, "rgba(201,47,53,0)")
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(dot[0], dot[1], 70, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#C92F35"; ctx.beginPath(); ctx.arc(dot[0], dot[1], 24, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(dot[0], dot[1], 9, 0, Math.PI * 2); ctx.fill()
    // Side labels, the active one in red.
    const sides = [["IN", x0 - 50, cy, -Math.PI / 2], ["HOLD", cx, y0 - 46, 0], ["OUT", x0 + side + 50, cy, Math.PI / 2], ["HOLD", cx, y0 + side + 62, 0]]
    sides.forEach(([label, x, y, r], k) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r)
      ctx.font = `800 34px ${SANS}`; ctx.letterSpacing = "4px"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = ph && ph.index === k ? "#C92F35" : "#B9AC9A"; ctx.fillText(label, 0, 0); ctx.restore()
    })
    ctx.restore()
    const rect = charRect(side * 0.86, cy + side * 0.04)
    character.render(ctx, f, rect)

    const ink = "#2B2622", muted = "#8A8178"
    const y = text(spec.hook.text, H * 0.115, { font: `600 84px ${SERIF}`, color: ink })
    text(spec.hook.sub, y + 6, { font: `700 40px ${SANS}`, color: muted, spacing: "1px" })
    phaseCue(f, H * 0.275, { labelFont: `600 80px ${SERIF}`, labelColor: ink, countFont: `400 52px ${SANS}`, countColor: "#C92F35", alpha: v.guide })
  },

  // Evening calm: dusk gradient, a warm glow that swells with the breath, a breath ring.
  glow(f, v) {
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, "#141A33"); bg.addColorStop(0.6, "#2C2645"); bg.addColorStop(1, "#4A3148")
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    // Stars twinkle on periods that divide the clip length, so the loop stays seamless.
    const T = frames.length / (spec.fps || 30)
    for (let i = 0; i < 70; i++) {
      const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * H * 0.62
      const k = 1 + (i % 3), a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(2 * Math.PI * k * f.t / T + i))
      ctx.fillStyle = `rgba(255,240,220,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 4) * 0.6, 0, Math.PI * 2); ctx.fill()
    }
    const breath = f.p.breath || 0, rect = charRect(H * 0.42, H * 0.64)
    let cx = W / 2, cy = rect.y + rect.h * 0.48, r = W * (0.36 + 0.1 * breath), lineWidth = 5
    if (spec.ring === "head") {
      // A perfect circle behind his head that touches the outer edge of his ears at rest
      // and widens with the breath. Its centre follows the head through the rig's own warp.
      const [hx, hy] = warp(0.5, 0.30, f.p), toScreen = (v, o, s) => o + s * (0.5 + (v - 0.5) * ART_SCALE)
      cx = toScreen(hx, rect.x, rect.w); cy = toScreen(hy, rect.y, rect.h); lineWidth = 12
      r = 0.278 * rect.w * ART_SCALE * (1 + 0.3 * breath) + lineWidth / 2
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.25)
    g.addColorStop(0, `rgba(255,196,140,${0.30 + 0.18 * breath})`); g.addColorStop(0.55, "rgba(255,170,120,0.10)"); g.addColorStop(1, "rgba(255,170,120,0)")
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    if (spec.ring === "outline") {
      silhouetteOutline(f, rect, { gap: 30 + 60 * breath, width: 12, color: `rgba(255,236,214,${0.5 + 0.3 * breath})` })
    } else {
      ctx.save(); ctx.strokeStyle = `rgba(255,236,214,${0.45 + 0.3 * breath})`; ctx.lineWidth = lineWidth
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
    }
    // Soft ground glow under the seat.
    const gy = rect.y + rect.h * 0.93, ground = ctx.createRadialGradient(cx, gy, 0, cx, gy, rect.w * 0.45)
    ground.addColorStop(0, "rgba(0,0,0,0.35)"); ground.addColorStop(1, "rgba(0,0,0,0)")
    ctx.save(); ctx.translate(0, gy); ctx.scale(1, 0.12); ctx.translate(0, -gy)
    ctx.fillStyle = ground; ctx.beginPath(); ctx.arc(cx, gy, rect.w * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    character.render(ctx, f, rect)

    const cream = "#F7EBDD", muted = "rgba(247,235,221,0.7)"
    const y = text(spec.hook.text, H * 0.13, { font: `600 88px ${SERIF}`, color: cream })
    text(spec.hook.sub, y + 8, { font: `600 42px ${SANS}`, color: muted, maxWidth: W - 240 })
    phaseCue(f, H * 0.32, { labelFont: `600 84px ${SERIF}`, labelColor: cream, countFont: `400 64px ${SANS}`, countColor: "#FFC48C", alpha: v.guide })
  },

  // No mascot. One cycle of the breath drawn as a line; a dot travels along it.
  // Rams-like: warm off-white, soft near-black, hairlines, one signal colour for the dot.
  graph(f, v) {
    const PAPER = "#F3F2EE", INK = "#232321", GREY = "#8E8C86", HAIR = "#D8D6D0", SIGNAL = "#D9541E"
    const GROTESK = "Inter, 'Helvetica Neue', Arial, sans-serif"
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H)
    const M = 110, x0 = M, x1 = W - M, yTop = H * 0.415, yBot = H * 0.565
    const ph = f.guide != null ? phaseAt(f.guide) : null

    // Breath level across one cycle, the same curve the app uses (smootherstep in and out).
    const ends = [], starts = []
    let level = 0
    for (const p of phases) {
      starts.push(level)
      level = p.role === "in" ? 1 : p.role === "out" || p.role === "natural" ? 0 : p.role === "sip" ? 1 : level
      ends.push(level)
    }
    const levelAt = s => {
      let i = 0
      while (i < phases.length - 1 && s >= phases[i].seconds) { s -= phases[i].seconds; i++ }
      return mix(starts[i], ends[i], ease(s / phases[i].seconds))
    }
    const X = s => x0 + (x1 - x0) * s / cycle, Y = l => yBot - (yBot - yTop) * l
    const now = ph ? f.guide % cycle : 0

    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"
    // Hairline frame: top and bottom rails, a tick each second, taller ticks at phase boundaries.
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2
    for (const y of [yTop, yBot]) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke() }
    let edge = 0
    const bounds = new Set(phases.map(p => (edge += p.seconds)).concat(0))
    for (let s = 0; s <= cycle; s++) {
      const tall = bounds.has(s)
      ctx.beginPath(); ctx.moveTo(X(s), yBot + 14); ctx.lineTo(X(s), yBot + (tall ? 44 : 26)); ctx.stroke()
    }
    // Curve: upcoming part light, travelled part ink.
    const path = (a, b) => { ctx.beginPath(); for (let k = 0; k <= 240; k++) { const s = a + (b - a) * k / 240; k ? ctx.lineTo(X(s), Y(levelAt(s))) : ctx.moveTo(X(s), Y(levelAt(s))) } ctx.stroke() }
    ctx.lineWidth = 5; ctx.strokeStyle = HAIR; path(0, cycle)
    ctx.lineWidth = 6; ctx.strokeStyle = INK; if (now > 0) path(0, now)
    // Dot with a hairline drop to the baseline.
    const dx = X(now), dy = Y(levelAt(now))
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx, yBot); ctx.stroke()
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(dx, dy, 26, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = SIGNAL; ctx.beginPath(); ctx.arc(dx, dy, 19, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Segment labels under the axis, the active one in ink.
    let at = 0
    phases.forEach((p, k) => {
      const mid = X(at + p.seconds / 2); at += p.seconds
      text(`${p.role === "natural" ? "REST" : p.role.toUpperCase()} ${p.seconds}`, yBot + 92, { font: `600 26px ${GROTESK}`, color: ph && ph.index === k ? INK : GREY, spacing: "3px", x: mid, maxWidth: 400 })
    })

    // Type on a left-aligned grid.
    const left = { x: x0, align: "left", maxWidth: x1 - x0 }
    const y = text(spec.hook.text, H * 0.135, { ...left, font: `600 76px ${GROTESK}`, color: INK, spacing: "-1px" })
    text(spec.hook.sub, y + 6, { ...left, font: `400 36px ${GROTESK}`, color: GREY })
    text(spec.title || "", yTop - 56, { ...left, font: `600 26px ${GROTESK}`, color: GREY, spacing: "3px" })
    text(phases.map(p => p.seconds).join(" · "), yTop - 56, { x: x1, align: "right", font: `600 26px ${GROTESK}`, color: GREY, spacing: "3px" })
    if (ph) {
      const a = ease(ph.offset / 0.35)
      text(LABEL[ph.role], H * 0.72, { ...left, font: `500 104px ${GROTESK}`, color: INK, alpha: a, spacing: "-2px" })
      text(String(ph.count), H * 0.72, { x: x1, align: "right", font: `300 104px ${GROTESK}`, color: GREY, alpha: a })
    }
    ctx.fillStyle = HAIR; ctx.fillRect(x0, H * 0.82, x1 - x0, 2)
    text("gutsphere", H * 0.82 + 56, { ...left, font: `600 28px ${GROTESK}`, color: GREY, spacing: "2px" })
  },

  // No mascot: hook on top, panning graph under it, big guide text at the bottom.
  scroll(f) {
    const { PAPER, GREY, FONT } = RAMS
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H)
    ramsHook(H * 0.12)
    text(spec.title || "", H * 0.275, { x: 96, align: "left", font: `600 26px ${FONT}`, color: GREY, spacing: "3px" })
    text(phases.map(p => p.seconds).join(" · "), H * 0.275, { x: W - 96, align: "right", font: `600 26px ${FONT}`, color: GREY, spacing: "3px" })
    scrollGraph(f, { yTop: H * 0.31, yBot: H * 0.46, ...spec.pan })
    guideText(f, H * 0.70, 128)
  },

  // Locked E1 look: hook on top, a big thick panning line, a small centred cue below.
  line(f) {
    const { PAPER, INK, GREY, FONT } = RAMS
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H)
    const below = text(spec.hook.text, H * 0.115, { font: `600 80px ${FONT}`, color: INK, spacing: "-1px", maxWidth: W - 160 })
    text(spec.hook.sub, below + 6, { font: `400 38px ${FONT}`, color: GREY, maxWidth: W - 200 })
    const cloud = spec.rider === "cloud"
    lineGraph(f, { yTop: H * (cloud ? 0.38 : 0.30), yBot: H * (cloud ? 0.64 : 0.62), rider: spec.rider, ...spec.pan })
    centredCue(f, H * (cloud ? 0.78 : 0.76))
  },

  // Mascot: hook on top, a slimmer panning strip, the mascot, guide text under him.
  scrollMascot(f) {
    const { PAPER } = RAMS
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H)
    ramsHook(H * 0.105)
    scrollGraph(f, { yTop: H * 0.235, yBot: H * 0.31, lineWidth: 5, dotRadius: 15, labels: false, ...spec.pan })
    const rect = charRect(H * 0.38, H * 0.545)
    drawScene(ctx, rect, f.p.breath || 0)
    character.render(ctx, f, rect)
    guideText(f, H * 0.80, 104)
  }
}

// ---------------------------------------------------------------- API for render.mjs
window.setup = async s => {
  spec = s; [W, H] = s.size || [1080, 1920]
  out.width = W; out.height = H
  await Promise.all([`600 80px Fraunces`, `400 80px "Nunito Sans"`, `600 80px "Nunito Sans"`, `800 80px "Nunito Sans"`, `300 80px Inter`, `400 80px Inter`, `500 80px Inter`, `600 80px Inter`].map(f => document.fonts.load(f)))
  character ||= await loadCharacter("breathing", "../animation-kit")
  if (s.format === "walkin") { if (!sprites) await loadSprites(); walkTrack = null }
  frames = build(s)
  return { count: frames.length, backend: character.backend, cycle }
}

window.frame = (i, type = "image/jpeg") => {
  const f = frames[i]
  ctx.clearRect(0, 0, W, H)
  STYLES[spec.style](f, visibility(f))
  return type ? out.toDataURL(type, 0.95) : null
}

// Browser preview: compose.html?sample=<name> plays a sample in real time.
const asked = new URLSearchParams(location.search).get("sample")
if (asked) {
  const { SAMPLES } = await import("./samples.mjs")
  const s = SAMPLES[asked] || Object.values(SAMPLES)[0]
  const { count } = await window.setup(s)
  const t0 = performance.now(), fps = s.fps || 30
  const loop = now => { window.frame(Math.floor((now - t0) / 1000 * fps) % count, null); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
}
