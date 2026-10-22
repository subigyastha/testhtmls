// Sound engine shared by audio.mjs (Node, final renders) and the portal (browser, live mixing).
// buildStems(spec, EXERCISES) synthesises every layer from the sample's own timeline and returns
// stereo Float32 stems at 48 kHz. Pure JS: no Node or browser APIs, so it runs in both.
// Everything is synthesised (no recordings), so it is ours to use commercially.

export function buildStems(spec, EXERCISES) {
  const SR = 48000, TAU = Math.PI * 2
  // spec.sound "app" (H4): no water anywhere (the sound-design rule for routines). An air bed that
  // breathes instead of the ocean, cues on the app's chime pitches (in 440, hold 523, out 330 Hz),
  // an Fmaj7 pad that holds those pitches, wooden taps instead of the droplet.
  const app = spec.sound === "app"
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const ease = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10) }
  
  // ---------------------------------------------------------------- timeline (mirrors compose.mjs)
  const ex = EXERCISES[spec.exercise]
  const phases = (spec.pattern || ex.roles.map((role, i) => ({ role, seconds: ex.phases[i] }))).filter(p => p.seconds > 0)
  const cycle = phases.reduce((s, p) => s + p.seconds, 0)
  const guideAt = spec.guideAt, guideEnd = guideAt + spec.rounds * cycle
  const duration = guideEnd + spec.outro.seconds, N = Math.ceil(duration * SR)
  
  const endLevel = (p, l) => p.role === "in" || p.role === "sip" ? 1 : p.role === "out" || p.role === "natural" ? 0 : l
  function cycleLevel(s) {
    s = ((s % cycle) + cycle) % cycle
    let level = 0, i = 0
    for (; i < phases.length - 1 && s >= phases[i].seconds; i++) { s -= phases[i].seconds; level = endLevel(phases[i], level) }
    return level + (endLevel(phases[i], level) - level) * ease(s / phases[i].seconds)
  }
  // "Breath" of the soundscape: a slow natural swell outside the routine, the real breath inside it.
  const swell = t => 0.32 + 0.14 * Math.sin(TAU * t / 7.5)
  function level(t) {
    if (t < guideAt - 2) return swell(t)
    if (t < guideAt) return swell(t) * (1 - ease((t - (guideAt - 2)) / 2))   // settle gently before round 1
    if (t < guideEnd) return cycleLevel(t - guideAt)
    return swell(t) * clamp(t - guideEnd)
  }
  
  // Phase starts → cue events.
  const cues = []
  for (let r = 0; r < spec.rounds; r++) {
    let at = guideAt + r * cycle
    for (const p of phases) { cues.push({ t: at, role: p.role, round: r }); at += p.seconds }
  }
  
  // Footsteps, from the walk's own easing (compose.mjs walkIn): contacts on steps 0 and 3 of 6.
  const W = spec.walk, steps = []
  if (W) {
    const n = (W.steps || [1, 2, 3, 4]).length, cycles = Math.max(1, Math.round(0.8 / (0.19 * n / 4))), total = cycles * n
    const every = W.steps ? n / 2 : n
    for (let s = 0; s <= total; s += every) {
      const travel = s / total, u = 1 - (1 - travel) ** (1 / 2.2)
      steps.push((W.walkFrom ?? 0) + u * (W.walk - (W.walkFrom ?? 0)))
    }
  }
  const sitAt = W ? W.walk + 0.65 : guideAt - 1.5           // walkKeys(): sit chain starts here
  const lineAt = text => (spec.lines || []).find(l => l.text === text)?.from
  
  // ---------------------------------------------------------------- tiny DSP kit
  let seed = 20261022
  const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const white = () => rand() * 2 - 1
  const stereo = () => [new Float32Array(N), new Float32Array(N)]
  const coef = fc => 1 - Math.exp(-TAU * fc / SR)
  
  function addTone(buf, t0, dur, pan, gen) {
    const i0 = Math.max(0, Math.round(t0 * SR)), n = Math.min(N - i0, Math.round(dur * SR))
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4)
    for (let i = 0; i < n; i++) { const v = gen(i / SR); buf[0][i0 + i] += v * gl; buf[1][i0 + i] += v * gr }
  }
  
  // Kalimba-ish pluck: warm fundamental, a quick metallic overtone for the attack, a soft 2nd.
  function pluck(buf, t0, f, amp, pan = 0, decay = 0.9) {
    addTone(buf, t0, decay * 2.5, pan, t => {
      const a = Math.min(1, t / 0.004)
      return amp * a * (Math.sin(TAU * f * t) * Math.exp(-t / decay) + 0.22 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / 0.07) + 0.12 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / 0.35))
    })
  }
  // Hollow bamboo tube: inharmonic partials, short and woody.
  function bamboo(buf, t0, f, amp, pan) {
    addTone(buf, t0, 1.6, pan, t => {
      const a = Math.min(1, t / 0.002)
      return amp * a * (Math.sin(TAU * f * t) * Math.exp(-t / 0.42) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / 0.16) + 0.12 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / 0.06))
    })
  }
  // Water droplet: a sine whose pitch rises fast as it rings out.
  function droplet(buf, t0, f, amp, pan) {
    let ph = 0
    addTone(buf, t0, 0.25, pan, t => {
      const fr = f * (1 + 0.9 * (1 - Math.exp(-t / 0.018)))
      ph += TAU * fr / SR
      return amp * Math.min(1, t / 0.001) * Math.sin(ph) * Math.exp(-t / 0.045)
    })
  }
  // Soft thump: low sine + low-passed noise, for steps and the sit.
  function thump(buf, t0, amp, pan, { len = 0.09, f = 85, fc = 320, attack = 0.004 } = {}) {
    let y = 0
    const c = coef(fc)
    addTone(buf, t0, len * 4, pan, t => {
      y += c * (white() - y)
      const env = Math.min(1, t / attack) * Math.exp(-t / len)
      return amp * env * (0.7 * Math.sin(TAU * f * t) + 1.6 * y)
    })
  }
  
  // Small Schroeder/Freeverb-style room for the tonal layers.
  function reverb([L, R], wet = 0.25) {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => Math.round(d * SR / 44100))
    const alls = [556, 441, 341].map(d => Math.round(d * SR / 44100))
    const run = (x, spread) => {
      const out = new Float32Array(N)
      for (const d of combs) {
        const buf = new Float32Array(d + spread); let idx = 0, low = 0
        for (let i = 0; i < N; i++) {
          const y = buf[idx]; low = y * 0.7 + low * 0.3
          buf[idx] = x[i] + low * 0.8; idx = (idx + 1) % buf.length; out[i] += y / combs.length
        }
      }
      for (const d of alls) {
        const buf = new Float32Array(d + spread); let idx = 0
        for (let i = 0; i < N; i++) { const b = buf[idx], y = -out[i] + b; buf[idx] = out[i] + b * 0.5; idx = (idx + 1) % buf.length; out[i] = y }
      }
      return out
    }
    const wl = run(L, 0), wr = run(R, 23)
    for (let i = 0; i < N; i++) { L[i] = L[i] * (1 - wet) + wl[i] * wet * 1.6; R[i] = R[i] * (1 - wet) + wr[i] * wet * 1.6 }
  }
  
  // ---------------------------------------------------------------- layers
  const bed = stereo()
  if (app) {
    // Air: white noise in a soft band that opens and brightens on the inhale (like the app's breath
    // sound, 750 → 1450 Hz) and settles on the exhale. White, not brown, so it reads as air, not surf.
    for (const ch of [0, 1]) {
      let h1 = 0, h2 = 0, l1 = 0, l2 = 0
      for (let i = 0; i < N; i++) {
        const t = i / SR, lvl = level(t), d = Math.abs(level(t + 0.05) - lvl) / 0.05
        const w = white()
        h1 += coef(160) * (w - h1); h2 += coef(160) * ((w - h1) - h2)
        const fc = 650 + 800 * lvl, x = (w - h1) - h2
        l1 += coef(fc) * (x - l1); l2 += coef(fc) * (l1 - l2)
        bed[ch][i] = l2 * (0.16 + 0.22 * lvl + 0.10 * clamp(d * 1.5))
      }
    }
  } else {
    const step = 64
    for (const ch of [0, 1]) {
      let brown = 0, y = 0, hp = 0, lp = 0
      for (let i = 0; i < N; i++) {
        const t = i / SR
        const lvl = level(t), d = (level(t + 0.05) - lvl) / 0.05     // + rising, − falling
        const w = white()
        brown = (brown + 0.02 * w) / 1.02
        y += coef(220 + 1000 * lvl) * (brown * 3.2 - y)               // waves: brighter as they swell
        hp += coef(1800) * (w - hp); lp += coef(6000) * ((w - hp) - lp)  // foam: 1.8–6 kHz, soft like water
        const foam = lp * (0.012 + 0.04 * clamp(-d * 1.6))               // hiss as the water recedes
        bed[ch][i] = y * (0.18 + 0.36 * lvl) + foam
      }
    }
  }
  
  const pad = stereo()
  {
    const voices = app ? [[174.61, 0], [220, -0.3], [261.63, 0.3], [329.63, -0.15], [440, 0.15]]   // Fmaj7: A, C, E = the cue pitches
      : [[146.83, 0], [220, -0.3], [293.66, 0.3], [369.99, -0.15], [440, 0.15]]
    const extra = app ? [392, 0.2] : [659.25, 0.2]                    // joins for the last two rounds
    // App: the pad itself breathes a little with the routine (about +2 dB on a full breath).
    const breathe = t => app && t >= guideAt && t < guideEnd ? 1 + 0.26 * cycleLevel(t - guideAt) : 1
    const lift = t => ease((t - (guideAt + 2 * cycle)) / 6) * (1 - ease((t - guideEnd - 1) / 3))
    const env = t => ease(t / 4) * (1 - ease((t - (duration - 3)) / 3))
    for (const [f, pan] of [...voices, extra]) {
      const isExtra = f === extra[0], lfo = 9 + (f % 5)
      addTone(pad, 0, duration, pan, t => {
        const a = env(t) * breathe(t) * (isExtra ? lift(t) * 0.7 : 1) * (0.75 + 0.25 * Math.sin(TAU * t / lfo))
        return 0.012 * a * (Math.sin(TAU * f * t) + Math.sin(TAU * (f + 0.18) * t + 1)) * 0.5
      })
    }
  }
  
  const tones = stereo()
  for (const c of app ? [] : cues) {
    const soft = c.round >= 2 ? 0.85 : 1, a = 0.11 * soft
    if (c.role === "in") { pluck(tones, c.t, 440, a, -0.15); pluck(tones, c.t + 0.14, 587.33, a * 0.9, 0.15) }
    if (c.role === "hold") pluck(tones, c.t, 369.99, a * 0.7, 0)
    if (c.role === "out") { pluck(tones, c.t, 587.33, a, 0.15); pluck(tones, c.t + 0.16, 440, a * 0.9, -0.15) }
  }
  // App cues land on the app's pitches: in rises E→A (440), out falls A→E (330), hold is one soft C (523).
  for (const c of app ? cues : []) {
    const a = 0.11 * (c.round >= 2 ? 0.85 : 1)
    if (c.role === "in" || c.role === "sip") { pluck(tones, c.t, 329.63, a * 0.55, -0.15); pluck(tones, c.t + 0.15, 440, a, 0.1, 1.1) }
    if (c.role === "hold") pluck(tones, c.t, 523.25, a * 0.6, 0, 0.8)
    if (c.role === "out") { pluck(tones, c.t, 440, a * 0.55, 0.15); pluck(tones, c.t + 0.17, 329.63, a, -0.1, 1.4) }
  }
  const chimes = stereo()
  const chime = (t0, count = 6) => {
    const notes = app ? [523.25, 587.33, 659.25, 783.99, 880] : [587.33, 659.25, 739.99, 880, 987.77]
    for (let k = 0; k < count; k++) bamboo(chimes, t0 + k * 0.17 + rand() * 0.08, notes[Math.floor(rand() * notes.length)], 0.07 * (1 - k / (count + 2)), rand() * 1.2 - 0.6)
  }
  const startAt = spec.chimeAt ?? lineAt("Let's start.")
  if (startAt != null) chime(startAt + 0.05)
  chime(guideEnd + 0.15, 7)
  
  const foley = stereo()
  if (W?.peek && app) { bamboo(foley, W.peek.in + 0.25, 783.99, 0.07, -0.5); bamboo(foley, W.peek.in + 0.42, 1046.5, 0.04, -0.45) }
  else if (W?.peek) { droplet(foley, W.peek.in + 0.25, 880, 0.16, -0.5); droplet(foley, W.peek.in + 0.42, 1240, 0.08, -0.45) }
  steps.forEach((t, k) => thump(foley, t, 0.11, (spec.mirror ? -1 : 1) * (0.35 - 0.3 * (k / Math.max(1, steps.length - 1))) + (k % 2 ? 0.08 : -0.08)))
  if (W) {
    thump(foley, W.walk + 0.22, 0.07, 0)                                                   // feet together
    for (const k of [0.3, 0.6, 0.9]) thump(foley, sitAt + k, 0.035, 0, { len: 0.12, f: 120, fc: 900, attack: 0.03 })  // robe rustle
    thump(foley, sitAt + 1.35, 0.14, 0, { len: 0.16, f: 70, fc: 260, attack: 0.02 })     // cushion puff
  }
  
  reverb(tones, 0.28); reverb(chimes, 0.35); reverb(foley, 0.12)
  
  
  return { SR, N, duration, guideAt, guideEnd, cycle, phases, stems: { bed, pad, cues: tones, chimes, foley } }
}
