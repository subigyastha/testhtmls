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
    for (const p of phases) { cues.push({ t: at, role: p.role, round: r, len: p.seconds, hum: !!p.hum }); at += p.seconds }
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
    const tine = strike.soft ? 0.08 : 0.22
    addTone(buf, t0, decay * 2.5, pan, t => {
      const a = Math.min(1, t / (strike.soft ? 0.009 : 0.004))
      return amp * a * (Math.sin(TAU * f * t) * Math.exp(-t / decay) + tine * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / 0.07) + 0.12 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / 0.35))
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
  
  // ---------------------------------------------------------------- sound palette
  // spec.palette picks each layer; without it, each look keeps its own sound (H3: ocean + kalimba +
  // bamboo + warm pad; H4: air + app kalimba + bamboo + Fmaj7 pad).
  //   bed     ocean | air | rain | stream | forest | night | fire | pink | brown | none
  //   cue     breaks | kalimba | bowl | gong | gonglarge | templebell | crystal | handpan | tongue | piano | marimba | vibes | harp | glass | musicbox | flute | chime | koshi | wood
  //   accent  breaks | bamboo | koshi | windchime | bowl | gong | gonglarge | templebell | crystal | harp | tongue | vibes | musicbox | rainstick | tingsha | none   ("Let's start", the finish, round marks)
  //   pad     fmaj7 | warm | tanpura | shruti | crystal | deep | none
  //   stroke  single | soft | ring | held | figure   (how the breath cues are played, see below)
  const P = { bed: app ? "air" : "ocean", cue: "kalimba", accent: "bamboo", pad: "warm", markRounds: false, stroke: "tune", ...(spec.palette || {}) }

  // How the next stroke is played, read by partials() and pluck(): soft = a felt mallet (rounder, the
  // upper partials and the click much quieter); swell = s, a soft mallet roll (the sound builds up
  // over the s seconds instead of starting with a hit).
  const strike = { soft: false, swell: 0 }

  // A sum of decaying partials: [freq, amp, decay s, attack s, beat Hz]. Beat > 0 adds a twin
  // partial slightly detuned, which gives bowls and bells their slow shimmer. The twins are unequal
  // (as in real metal), so the shimmer swells and dips but never fully cancels into a wobble.
  // Oscillators are stepped by rotation and envelopes by a per-sample multiplier (no sin/exp per
  // sample), and each partial stops once it has decayed below audibility.
  // glide [ratio, seconds]: every partial bends by `ratio` over `seconds` (easing out), like a
  // Chinese opera gong whose pitch rises or falls after the stroke.
  function partials(buf, t0, dur, pan, parts, noise = 0, glide = null) {
    const i0 = Math.max(0, Math.round(t0 * SR)), n = Math.min(N - i0, Math.round(dur * SR))
    if (n <= 0) return
    if (strike.soft || strike.swell) {
      const W = strike.swell
      parts = parts.map(([f, a, d, at, b], k) => [f, k && strike.soft ? a * 0.45 : a, W ? Math.max(d, W * 0.8) : d, W ? Math.max(at, W * (0.3 + 0.15 * k / parts.length)) : Math.max(at, 0.008), b])
      noise *= W ? 0 : 0.35
    }
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4)
    const oscs = []
    for (const [f, a, d, at, beat] of parts) for (const [ff, aa, p0] of beat ? [[f, a * 0.64, 0], [f + beat, a * 0.36, 1.3]] : [[f, a, 0]]) {
      if (ff * (glide ? Math.max(1, glide[0]) : 1) >= SR / 2) continue
      // Each partial rings until it dies away (7 decay times, about −60 dB) or the note's length,
      // whichever is first, and always fades out softly: cutting a ringing bowl short clicks.
      oscs.push({ f: ff, c: Math.cos(TAU * ff / SR), s: Math.sin(TAU * ff / SR), x: Math.cos(p0), y: Math.sin(p0), a: aa, k: Math.exp(-1 / (d * SR)), att: Math.max(1, at * SR), end: Math.min(N - i0, Math.ceil(Math.min(d * 7, dur) * SR)) })
    }
    const L = buf[0], R = buf[1], gN = glide ? glide[1] * SR : 0
    for (const o of oscs) {
      let x = o.x, y = o.y, env = o.a, c = o.c, s = o.s
      const tail = Math.max(1, Math.min(Math.round(0.4 * SR), Math.floor(o.end / 3)))
      for (let i = 0; i < o.end; i++) {
        if (glide && (i & 31) === 0 && i <= gN + 32) {
          const u = Math.min(1, i / gN), w = TAU * o.f * (1 + (glide[0] - 1) * (1 - (1 - u) ** 2)) / SR
          c = Math.cos(w); s = Math.sin(w)
        }
        const v = y * env * (i < o.att ? i / o.att : 1) * (o.end - i < tail ? (o.end - i) / tail : 1)
        L[i0 + i] += v * gl; R[i0 + i] += v * gr
        const nx = x * c - y * s; y = x * s + y * c; x = nx; env *= o.k
      }
    }
    if (noise) {
      let z = 0
      const cN = coef(strike.soft ? 700 : 1800), m = Math.min(n, Math.round(0.08 * SR)), k = Math.exp(-1 / ((strike.soft ? 0.02 : 0.012) * SR))
      for (let i = 0, e = noise; i < m; i++, e *= k) { z += cN * (white() - z); L[i0 + i] += z * e * gl; R[i0 + i] += z * e * gr }
    }
  }
  // Tibetan-style singing bowl: inharmonic partials (1 : 2.71 : 5.15 : 8.39), long ring, slow beats.
  const bowl = (buf, t0, f, amp, pan, size = 1) => partials(buf, t0, 15 * size, pan,
    [[f, amp, 8 * size, 0.006, 1.1], [f * 2.71, amp * 0.5, 4.5 * size, 0.005, 1.7], [f * 5.15, amp * 0.28, 2.6 * size, 0.004, 2.4], [f * 8.39, amp * 0.13, 1.5 * size, 0.004, 3.1], [f * 12.2, amp * 0.05, 0.8, 0.003, 4]], amp * 0.4)
  // Quartz crystal bowl: almost a pure tone that swells in as it is rubbed, very long and smooth.
  const crystal = (buf, t0, f, amp, pan, size = 1) => partials(buf, t0, 16 * size, pan,
    [[f, amp, 9 * size, 0.45, 0.6], [f * 2, amp * 0.1, 5, 0.6, 0.9], [f * 3, amp * 0.04, 2.5, 0.7, 1.2]])
  // Handpan: tuned fundamental with strong octave and twelfth, a soft thumb thump.
  const handpan = (buf, t0, f, amp, pan) => partials(buf, t0, 4, pan,
    [[f, amp, 2.4, 0.003, 0.3], [f * 2, amp * 0.55, 1.4, 0.003, 0.5], [f * 3, amp * 0.22, 0.6, 0.003, 0], [f * 4.2, amp * 0.06, 0.25, 0.002, 0]], amp * 0.5)
  // Soft felt piano: slightly stretched harmonics, the upper ones damped, a muffled hammer.
  const piano = (buf, t0, f, amp, pan) => partials(buf, t0, 4, pan,
    [1, 2, 3, 4, 5, 6].map(n => [f * n * Math.sqrt(1 + 0.0003 * n * n), amp / n ** 1.7 * (n > 3 ? 0.5 : 1), 2.6 / Math.sqrt(n), 0.005, 0]), amp * 0.25)
  // Meditation chime (a single tuned bar): pure tone, gentle metallic overtone, long tail.
  const chimeBar = (buf, t0, f, amp, pan) => partials(buf, t0, 6, pan,
    [[f, amp, 4.5, 0.002, 0.35], [f * 2.76, amp * 0.18, 1.2, 0.002, 0], [f * 5.4, amp * 0.06, 0.4, 0.002, 0]])
  // Koshi-style chime rods: bright metal partials, shorter decays.
  const koshiRod = (buf, t0, f, amp, pan) => partials(buf, t0, 2.6, pan,
    [[f, amp, 1.6, 0.002, 0.2], [f * 2.756, amp * 0.45, 0.9, 0.002, 0], [f * 5.404, amp * 0.22, 0.5, 0.001, 0], [f * 8.933, amp * 0.08, 0.3, 0.001, 0]])
  // Soft wood tone (temple-block style, gentle): short resonant knock.
  const wood = (buf, t0, f, amp, pan) => partials(buf, t0, 0.5, pan, [[f, amp, 0.09, 0.001, 0], [f * 2.3, amp * 0.35, 0.04, 0.001, 0]], amp * 0.6)
  // Gong: a felt mallet on a flat (meditation) gong. Dozens of inharmonic modes: the low ones sound
  // at once, the higher ones "bloom" in smoothly over the first second as the metal starts to
  // shimmer, then everything rings down slowly, the highs first. Each gong (f0 + count) has its own
  // fixed set of modes, so striking the same gong twice sounds like the same gong. A bigger gong =
  // lower f0 and larger size: longer ring, slower bloom.
  function gong(buf, t0, amp, pan = 0, f0 = 68, count = 28, dur = 12, { size = 1, glide = null, bloom = 1, dark = 0 } = {}) {
    let sd = Math.round(f0 * 1000) * 31 + count
    const mr = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648 }
    const parts = [[f0, amp * 0.55, 10 * size, 0.012, 0.12], [f0 * 1.52, amp * 0.3, 8 * size, 0.015, 0.2]]
    for (let k = 0; k < count; k++) {
      // A plate's modes spread fairly evenly in frequency (more of them up high), not bunched low.
      const r = 1.3 + 54 * mr() ** 1.4, f = f0 * r
      parts.push([f, amp * (0.35 + 0.65 * mr()) / r ** (0.7 + dark), 10 * size / (1 + r * 0.3), 0.015 + bloom * 0.8 * size * ((r / 56) ** 0.6) * (0.7 + 0.3 * mr()), 0.05 + 0.35 * mr()])
    }
    const v = 0.92 + 0.12 * rand()                                     // no two strokes exactly alike
    partials(buf, t0, dur, pan, parts.map(([f, a, ...x]) => [f, a * v, ...x]), 0, glide)
    if (!strike.swell) thump(buf, t0, amp * v * (strike.soft ? 0.9 : 1.3), pan, { len: 0.05 * size, f: Math.max(45, f0 * 0.8), fc: strike.soft ? 260 : 450, attack: 0.004 })
  }
  // Large gong: a deep tam-tam that blooms for a second or two and rings for a long time.
  const bigGong = (buf, t0, amp, pan = 0, f0 = 45, dur = 24, o = {}) => gong(buf, t0, amp, pan, f0, 56, dur, { size: 1.8, ...o })
  // Nepalese temple bell (cast bronze, hung in temple courtyards): bell partials (hum an octave
  // below, prime, minor-third tierce, quint, nominal...), each pair slowly warbling, a long hum, a
  // bright clapper strike. f = the prime.
  const templeBell = (buf, t0, f, amp, pan, size = 1) => partials(buf, t0, 16 * size, pan, [
    [f * 0.5, amp * 0.55, 13 * size, 0.004, 0.25], [f, amp * 0.8, 8 * size, 0.002, 0.4], [f * 1.19, amp * 0.5, 6 * size, 0.002, 0],
    [f * 1.5, amp * 0.28, 4 * size, 0.002, 0.7], [f * 2, amp * 0.6, 3.6 * size, 0.001, 0], [f * 2.51, amp * 0.22, 2.2 * size, 0.001, 1.1],
    [f * 2.67, amp * 0.18, 1.9 * size, 0.001, 0], [f * 3.01, amp * 0.13, 1.3 * size, 0.001, 0], [f * 4.17, amp * 0.07, 0.7, 0.001, 0], [f * 5.43, amp * 0.035, 0.4, 0.001, 0]
  ], amp * 0.6)
  // Hold: one steady, soft tone that swells in and stays for the whole hold, then lets go just
  // before the next phase. Same instrument stroke on top, so it continues the cue but is clearly
  // "still" rather than moving.
  function hum(buf, t0, f, amp, len, pan = 0) {
    const L = Math.max(1.2, len - 0.25)
    addTone(buf, t0, L, pan, t => amp * ease(t / 0.7) * (1 - ease((t - (L - 0.9)) / 0.9)) * (0.92 + 0.08 * Math.sin(TAU * 0.45 * t))
      * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * (f + 0.3) * t + 1) + 0.12 * Math.sin(TAU * 2 * f * t)) / 1.6)
  }
  // Steel tongue drum: round fundamental, faint upper partials, a soft mallet.
  const tongue = (buf, t0, f, amp, pan) => partials(buf, t0, 4.5, pan,
    [[f, amp, 2.8, 0.004, 0.25], [f * 3.02, amp * 0.12, 0.8, 0.003, 0], [f * 5.2, amp * 0.04, 0.3, 0.002, 0]], amp * 0.3)
  // Marimba: a wooden bar over a tube; warm and quick (the 4th partial is the bar's bright tone).
  const marimba = (buf, t0, f, amp, pan) => partials(buf, t0, 2, pan,
    [[f, amp, 0.9, 0.002, 0], [f * 4, amp * 0.25, 0.18, 0.001, 0], [f * 9.9, amp * 0.05, 0.05, 0.001, 0]], amp * 0.2)
  // Vibraphone: a metal bar with the motor's slow tremolo.
  function vibes(buf, t0, f, amp, pan) {
    addTone(buf, t0, 5, pan, t => amp * Math.min(1, t / 0.002) * (1 - 0.28 * (0.5 + 0.5 * Math.sin(TAU * 5.2 * t)))
      * (Math.sin(TAU * f * t) * Math.exp(-t / 2.6) + 0.18 * Math.sin(TAU * f * 4 * t) * Math.exp(-t / 0.4)) * (1 - ease((t - 4.4) / 0.6)))
  }
  // Harp: a plucked string, the upper harmonics fading first.
  const harp = (buf, t0, f, amp, pan) => partials(buf, t0, 4.5, pan,
    [1, 2, 3, 4, 5, 6, 7].map(n => [f * n, amp / n ** 1.3, 2.6 / n ** 0.6, 0.002, 0]))
  // Glass harmonica: a rubbed glass, pure and airy, a little brighter than a crystal bowl.
  const glass = (buf, t0, f, amp, pan) => partials(buf, t0, 5, pan,
    [[f, amp, 2.2, 0.25, 0.5], [f * 2, amp * 0.16, 1.4, 0.3, 0.7], [f * 3, amp * 0.06, 0.8, 0.3, 0]])
  // Music box: tiny steel comb teeth, delicate and short.
  const musicbox = (buf, t0, f, amp, pan) => partials(buf, t0, 2.4, pan,
    [[f, amp, 1.3, 0.001, 0.15], [f * 2.97, amp * 0.25, 0.3, 0.001, 0], [f * 5.8, amp * 0.08, 0.12, 0.001, 0]])
  // Bamboo flute: a soft tone with breath noise and a little vibrato, swelling in and out.
  function flute(buf, t0, f, amp, pan, len = 1.3) {
    let ph = 0, b1 = 0, b2 = 0
    addTone(buf, t0, len + 0.5, pan, t => {
      const env = ease(t / 0.18) * (1 - ease((t - len) / 0.45)), vib = 1 + 0.004 * Math.sin(TAU * 5 * t) * ease((t - 0.3) / 0.4)
      ph += TAU * f * vib / SR
      const w = white(); b1 += coef(f * 1.5) * (w - b1); b2 += coef(f * 0.7) * (b1 - b2)
      return amp * env * (Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.04 * Math.sin(3 * ph) + 0.9 * (b1 - b2))
    })
  }
  // Tingsha: two small cymbals touched together. High, bright, beating.
  const tingsha = (buf, t0, amp, pan = 0) => partials(buf, t0, 4, pan,
    [[2630, amp, 2.8, 0.002, 4.2], [2630 * 1.47, amp * 0.5, 1.8, 0.002, 6], [2630 * 2.21, amp * 0.25, 1, 0.001, 7.5]])
  // Rainstick: a fall of tiny seed clicks, thickening then thinning.
  function rainstick(buf, t0, amp, len = 2.6) {
    const n = Math.round(len * 160)
    for (let k = 0; k < n; k++) {
      const u = rand(), at = t0 + u * len, dens = Math.sin(Math.PI * u) ** 0.7
      if (rand() > dens) continue
      const f = 2200 + rand() * 4200
      addTone(buf, at, 0.03, rand() * 1.4 - 0.7, t => amp * (0.3 + 0.7 * rand()) * Math.sin(TAU * f * t) * Math.exp(-t / 0.006))
    }
  }

  // ---------------------------------------------------------------- layers
  const bed = stereo()
  const breathAmp = t => 0.78 + 0.34 * level(t)                   // gentle swell with the breath for any bed
  if (P.bed === "air") {
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
  } else if (P.bed === "ocean") {
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
  } else if (P.bed === "rain") {
    // Soft steady rain: a dark hiss plus thousands of tiny drops.
    for (const ch of [0, 1]) {
      let a = 0, b = 0
      for (let i = 0; i < N; i++) { const w = white(); a += coef(4200) * (w - a); b += coef(400) * (a - b); bed[ch][i] = (a - b) * 0.05 * breathAmp(i / SR) }
    }
    for (let k = 0, n = Math.round(duration * 55); k < n; k++) {
      const at = rand() * duration, f = 1500 + rand() * 3500, amp = 0.012 + 0.03 * rand() ** 3
      addTone(bed, at, 0.02, rand() * 1.6 - 0.8, t => amp * Math.sin(TAU * f * t) * Math.exp(-t / 0.004))
    }
  } else if (P.bed === "stream") {
    // Forest stream: low water rumble, a mid "babble" band and small rising bubbles.
    for (const ch of [0, 1]) {
      let lo = 0, m1 = 0, m2 = 0, mod = 0
      for (let i = 0; i < N; i++) {
        const t = i / SR, w = white()
        lo += coef(260) * (w * 3 - lo); m1 += coef(1700) * (w - m1); m2 += coef(500) * (m1 - m2)
        mod += coef(3) * (white() - mod)
        bed[ch][i] = (lo * 0.05 + (m1 - m2) * (0.05 + 0.6 * Math.abs(mod))) * breathAmp(t)
      }
    }
    for (let k = 0, n = Math.round(duration * 14); k < n; k++) droplet(bed, rand() * duration, 380 + rand() * 700, 0.02 + 0.03 * rand(), rand() * 1.4 - 0.7)
  } else if (P.bed === "forest") {
    // Wind through leaves in slow gusts, with a few distant, gentle bird calls.
    for (const ch of [0, 1]) {
      let a = 0, b = 0, g = 0
      for (let i = 0; i < N; i++) {
        const t = i / SR, w = white()
        a += coef(2500) * (w - a); b += coef(300) * (a - b); g += coef(0.25) * (white() * 6 - g)
        bed[ch][i] = (a - b) * (0.03 + 0.05 * clamp(0.5 + g)) * breathAmp(t)
      }
    }
    for (let t = 2 + rand() * 3; t < duration - 2; t += 4 + rand() * 6) {
      const notes = 2 + Math.floor(rand() * 4), base = 2600 + rand() * 1600, pan = rand() * 1.6 - 0.8
      for (let k = 0; k < notes; k++) {
        let ph = 0
        const f0 = base * (1 + 0.08 * (rand() - 0.5)), at = t + k * (0.12 + rand() * 0.08)
        addTone(bed, at, 0.12, pan, u => { ph += TAU * f0 * (1.25 - 0.45 * u / 0.12) / SR; return 0.012 * Math.sin(ph) * Math.sin(Math.PI * Math.min(1, u / 0.1)) })
      }
    }
  } else if (P.bed === "night") {
    // Warm night: soft low wind and two far-off crickets chirping at their own pace.
    for (const ch of [0, 1]) {
      let a = 0, b = 0
      for (let i = 0; i < N; i++) { const w = white(); a += coef(900) * (w - a); b += coef(150) * (a - b); bed[ch][i] = (a - b) * 0.035 * breathAmp(i / SR) }
    }
    for (const [f, every, pan] of [[4300, 0.85, -0.6], [4650, 1.12, 0.55]]) {
      for (let t = rand(); t < duration; t += every * (0.9 + 0.2 * rand())) {
        for (let p = 0; p < 3; p++) addTone(bed, t + p * 0.035, 0.03, pan, u => 0.006 * Math.sin(TAU * f * u) * Math.sin(Math.PI * u / 0.03))
      }
    }
  } else if (P.bed === "fire") {
    // Fireside: a low warm rumble and soft crackles.
    for (const ch of [0, 1]) {
      let lo = 0
      for (let i = 0; i < N; i++) { lo += coef(180) * (white() * 3 - lo); bed[ch][i] = lo * 0.06 * breathAmp(i / SR) }
    }
    for (let k = 0, n = Math.round(duration * 7); k < n; k++) {
      let y = 0
      const at = rand() * duration, amp = 0.02 + 0.06 * rand() ** 2, len = 0.004 + 0.012 * rand()
      addTone(bed, at, 0.06, rand() * 1.2 - 0.6, u => { const w = white(); y += coef(2500) * (w - y); return amp * (w - y) * Math.exp(-u / len) })
    }
  } else if (P.bed === "pink" || P.bed === "brown") {
    // Pink noise (even energy per octave, soft and full) or brown noise (deeper, like a distant
    // rumble). Both are popular for focus and sleep. Pink uses Paul Kellet's filter.
    for (const ch of [0, 1]) {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0, lp = 0
      for (let i = 0; i < N; i++) {
        const w = white()
        let v
        if (P.bed === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
          v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926
        } else { br = (br + 0.02 * w) / 1.02; v = br * 3.5 }
        lp += coef(9000) * (v - lp)
        bed[ch][i] = lp * breathAmp(i / SR)
      }
    }
  }

  const pad = stereo()
  const padEnv = t => ease(t / 4) * (1 - ease((t - (duration - 3)) / 3))
  if (P.pad === "warm") {
    // Fmaj7 in both looks, the Breaks extension's chord: A, C, E are the cue pitches.
    const voices = [[174.61, 0], [220, -0.3], [261.63, 0.3], [329.63, -0.15], [440, 0.15]]
    const extra = [392, 0.2]                                         // joins for the last two rounds
    // App: the pad itself breathes a little with the routine (about +2 dB on a full breath).
    const breathe = t => app && t >= guideAt && t < guideEnd ? 1 + 0.26 * cycleLevel(t - guideAt) : 1
    const lift = t => ease((t - (guideAt + 2 * cycle)) / 6) * (1 - ease((t - guideEnd - 1) / 3))
    for (const [f, pan] of [...voices, extra]) {
      const isExtra = f === extra[0], lfo = 9 + (f % 5)
      addTone(pad, 0, duration, pan, t => {
        const a = padEnv(t) * breathe(t) * (isExtra ? lift(t) * 0.7 : 1) * (0.75 + 0.25 * Math.sin(TAU * t / lfo))
        return 0.012 * a * (Math.sin(TAU * f * t) + Math.sin(TAU * (f + 0.18) * t + 1)) * 0.5
      })
    }
  } else if (P.pad === "fmaj7") {
    // The Breaks extension's pad (audio.mjs startAmbience): Fmaj7 (F A C E A), each voice a pair 0.18 Hz
    // apart at 0.0045, its level drifting ±0.0015 over about a minute, swelling ×(1 + 0.26 · breath).
    const breathe = t => t >= guideAt && t < guideEnd ? 1 + 0.26 * cycleLevel(t - guideAt) : 1
    for (const [f, pan] of [[174.61, 0], [220, -0.3], [261.63, 0.3], [329.63, -0.15], [440, 0.15]]) {
      const w = 1 / (9 + (f % 5))
      addTone(pad, 0, duration, pan, t => padEnv(t) * breathe(t) * (0.0045 + 0.0015 * Math.sin(w * t)) * (Math.sin(TAU * f * t) + Math.sin(TAU * (f + 0.18) * t + 1)))
    }
  } else if (P.pad === "tanpura") {
    // Tanpura drone: four strings (Pa Sa Sa low-Sa on F, the Breaks key) plucked in a slow cycle, each note
    // brightening as the bridge "buzz" (jawari) sweeps through the harmonics, then settling.
    const strings = [[130.81, -0.3], [174.61, 0.1], [174.61, 0.3], [87.31, -0.1]], period = 5.2
    for (let t = 0, k = 0; t < duration; t += period / 4, k++) {
      const [f, pan] = strings[k % 4]
      // Harmonic weights change slowly, so they're recomputed every 256 samples, not every sample.
      const wts = new Float32Array(15)
      let block = -1
      addTone(pad, t, 5, pan, u => {
        const b = Math.floor(u * SR / 256)
        if (b !== block) { block = b; const c = 3 + 9 * Math.min(1, u / 1.4); for (let n = 1; n <= 14; n++) wts[n] = (0.35 + 0.65 * Math.exp(-((n - c) ** 2) / 6)) / n }
        let v = 0
        const ph = TAU * f * u
        for (let n = 1; n <= 14; n++) v += Math.sin(ph * n) * wts[n]
        return 0.006 * padEnv(t + u) * Math.min(1, u / 0.01) * Math.exp(-u / 3.2) * (1 - ease((u - 4.2) / 0.75)) * v   // fades out, never cut
      })
    }
  } else if (P.pad === "crystal") {
    // Two crystal-bowl tones held as a drone (C and G), slowly beating.
    for (const [f, pan] of [[130.81, -0.3], [196, 0.3], [261.63, 0]]) {
      addTone(pad, 0, duration, pan, t => 0.011 * padEnv(t) * (0.8 + 0.2 * Math.sin(TAU * t / (11 + f % 3))) * 0.5 * (Math.sin(TAU * f * t) + Math.sin(TAU * (f + 0.4) * t)))
    }
  } else if (P.pad === "shruti") {
    // Shruti box: hand-pumped reeds (F and C, the Breaks key) with a reedy, softened tone that swells with each pump.
    for (const [f, pan] of [[174.61, -0.25], [261.63, 0.25], [87.31, 0]]) {
      addTone(pad, 0, duration, pan, t => {
        let v = 0
        for (let n = 1; n <= 9; n++) v += Math.sin(TAU * f * n * t + n) / n ** 1.4 * (n % 2 ? 1 : 0.55)
        return 0.009 * padEnv(t) * (0.82 + 0.18 * Math.sin(TAU * t / 3.7 + f)) * v
      })
    }
  } else if (P.pad === "deep") {
    // Deep drone: a low A with its octave and fifth, slowly beating, felt more than heard.
    for (const [f, pan, a] of [[55, 0, 1], [110, -0.2, 0.5], [164.81, 0.2, 0.25]]) {
      addTone(pad, 0, duration, pan, t => 0.016 * a * padEnv(t) * (0.85 + 0.15 * Math.sin(TAU * t / 13)) * 0.5 * (Math.sin(TAU * f * t) + Math.sin(TAU * (f + 0.25) * t)))
    }
  }

  // Breath cues: one stroke as each phase starts. Like a set of the same instrument in three
  // sizes: breathe in = the small one (higher, brighter), hold = the middle one, breathe out = the
  // big one (lower, deeper, rings longer). Every instrument has a home note R (the hold); in sits a
  // fifth above, out an octave below (a fifth below for gongs, which are deep already).
  // P.stroke picks how the cues are played, to compare:
  //   single  one stroke per phase (in, hold, out)
  //   soft    the same with a soft felt mallet: rounder, no click
  //   ring    strokes on in and out only; the hold is the out/in stroke ringing on
  //   held    in and out struck; the hold is a soft roll on the middle one that swells and fades
  //   figure  the earlier version: a short run of notes up for in, down for out, hum on hold
  const tones = stereo()
  const ST = n => 2 ** (n / 12)
  // heavy: rings long and is rolled by swelling (a gong or bowl roll); others roll by soft repeats.
  const CUE = {
    kalimba: app ? { R: 440, play: (b, t, f, a, p) => pluck(b, t, f, a, p, 1.1), amp: 0.11 }     // the app's A (440 Hz) at home
      : { R: 293.66, play: pluck, amp: 0.11 },
    bowl: { R: 220, play: (b, t, f, a, p, s) => bowl(b, t, f, a, p, 0.55 * s), amp: 0.07, heavy: true },
    gong: { R: 98, steps: [7, -7], play: (b, t, f, a, p, s) => gong(b, t, a, p, f, 34, 10 * s, { size: s }), amp: 0.05, heavy: true },
    gonglarge: { R: 65.41, steps: [7, -7], play: (b, t, f, a, p, s) => bigGong(b, t, a, p, f, 14 * s, { size: 1.6 * s }), amp: 0.06, heavy: true },
    templebell: { R: 392, play: (b, t, f, a, p, s) => templeBell(b, t, f, a, p, 0.45 * s), amp: 0.06, heavy: true },
    crystal: { R: 261.63, play: (b, t, f, a, p, s) => crystal(b, t, f, a, p, 0.7 * s), amp: 0.06, heavy: true },
    handpan: { R: 220, play: handpan, amp: 0.1 },
    piano: { R: 261.63, play: piano, amp: 0.12 },
    chime: { R: 440, play: chimeBar, amp: 0.08 },
    koshi: { R: 523.25, play: koshiRod, amp: 0.06 },
    wood: { R: 587.33, play: wood, amp: 0.1 },
    tongue: { R: 293.66, play: tongue, amp: 0.1 },
    marimba: { R: 261.63, play: marimba, amp: 0.12 },
    vibes: { R: 293.66, play: vibes, amp: 0.08 },
    harp: { R: 293.66, play: harp, amp: 0.08 },
    glass: { R: 392, play: glass, amp: 0.07, heavy: true },
    musicbox: { R: 523.25, play: musicbox, amp: 0.08 },
    flute: { R: 440, play: (b, t, f, a, p, s, len = 0.9) => flute(b, t, f, a, p, len), amp: 0.06, sustained: true }
  }
  const C = CUE[P.cue] || CUE.kalimba, [up, down] = C.steps || [7, -12]
  const size = f => (C.R / f) ** 0.6                                // the bigger instrument rings longer
  const pitch = { in: C.R * ST(up), hold: C.R, out: C.R * ST(down) }
  // The earlier "figure" version: runs of notes (two for long-ringing instruments) and a hum on hold.
  const two = C.heavy || C.sustained, gap = two ? 0.7 : 0.16
  const figure = {
    in: (two ? [1, 2] : [1, ST(7), 2]).map((m, k, l) => [C.R * m, two ? [0.55, 1][k] : 0.75 + 0.25 * k / 2, k * gap]),
    hold: [[C.R, two ? 0.4 : 0.5]],
    out: (two ? [ST(-5), 0.5] : [1, ST(-5), 0.5]).map((m, k) => [C.R * m, two ? [0.35, 1.25][k] : 0.8 + 0.3 * k / 2, k * gap * 1.3])
  }
  // Humming routine: under a "hum" out-breath, the Breaks extension's hum (audio.mjs humTone): a
  // triangle on F3 and a quarter-level sine on F4, both with a 4.2 Hz ±1.6 Hz vibrato, low-passed at
  // 700 Hz; it rises over min(1 s, ¼ of its length), holds to 70 %, then fades.
  function humTone(t0, len, amp) {
    const f = 174.61, L = len - 0.6
    if (L <= 0.4) return
    let p1 = 0, p2 = 0, l1 = 0, l2 = 0
    addTone(tones, t0 + 0.3, L, 0, t => {
      const vib = 1.6 * Math.sin(TAU * 4.2 * t)
      p1 += TAU * (f + vib) / SR; p2 += TAU * (2 * f + vib) / SR
      const x = (2 / Math.PI) * Math.asin(Math.sin(p1)) + 0.25 * Math.sin(p2)
      l1 += coef(700) * (x - l1); l2 += coef(700) * (l1 - l2)
      const up = Math.min(1, L / 4), env = t < up ? t / up : t < 0.7 * L ? 1 : 1 - (t - 0.7 * L) / (0.3 * L)
      return amp * env * l2
    })
  }
  // The Breaks extension's cues, note for note (audio.mjs cue): kalimba plucks on the app's chime
  // pitches. in E4 → A4, hold one soft C5, sip D5, out A4 → E4; softer from the third round. Played
  // exactly, so the stroke setting doesn't apply.
  function breaksCue(c) {
    const t = c.t + 0.02, a = 0.11 * (c.round >= 2 ? 0.85 : 1)
    if (c.role === "in") { pluck(tones, t, 329.63, a * 0.55, -0.15); pluck(tones, t + 0.15, 440, a, 0.1, 1.1) }
    if (c.role === "hold") pluck(tones, t, 523.25, a * 0.6, 0, 0.8)
    if (c.role === "sip") pluck(tones, t, 587.33, a * 0.7, 0.05, 0.6)
    if (c.role === "out") { pluck(tones, t, 440, a * 0.55, 0.15); pluck(tones, t + 0.17, 329.63, a, -0.1, 1.4) }
    if (c.hum && c.len > 1) humTone(t, c.len, a * 0.5)
  }
  // "tune": the Breaks extension's cue melody on the chosen instrument, moved by whole octaves to sit
  // where that instrument lives (gongs low, wood high). in E → A, hold C, sip D, out A → E, the first
  // note of each pair a lighter grace note; long-ringing instruments leave a wider gap between the two.
  const oct = 2 ** Math.round(Math.log2(C.R / 380)), grace = C.heavy || C.sustained ? 0.32 : 0.15
  const TUNE = {
    in: [[329.63, 0.55, 0], [440, 1, grace]], hold: [[523.25, 0.6, 0]], sip: [[587.33, 0.7, 0]],
    out: [[440, 0.55, 0], [329.63, 1.1, grace * 1.13]]
  }
  for (const c of cues) {
    if (P.cue === "breaks") { breaksCue(c); continue }
    if (P.stroke === "tune") {
      if (c.hum) humTone(c.t, c.len, C.amp * 0.5)
      const a = C.amp * (c.round >= 2 ? 0.85 : 1) * (0.94 + 0.1 * rand()), pan = (rand() - 0.5) * 0.3
      for (const [f, rel, dt] of TUNE[c.role] || []) C.play(tones, c.t + 0.02 + dt + 0.01 * rand(), f * oct, a * rel, pan + (dt ? 0.1 : -0.1), size(f * oct))
      continue
    }
    const role = c.role === "sip" ? "in" : c.role
    if (c.hum) humTone(c.t, c.len, C.amp * 0.5)
    if (!pitch[role]) continue
    const a = C.amp * (c.round >= 2 ? 0.85 : 1) * (0.94 + 0.1 * rand())   // a hand, not a machine
    const t = c.t + 0.012 * rand(), pan = (rand() - 0.5) * 0.3, f = pitch[role]
    if (P.stroke === "figure") {
      figure[role].forEach(([fn, rel, dt]) => C.play(tones, c.t + dt, fn, a * rel, pan, size(fn)))
      if (role === "hold") hum(tones, c.t + 0.05, C.R * (C.R < 150 ? 2 : 1), a * (two ? 0.2 : 0.3), c.len)
      continue
    }
    if (role === "hold" && P.stroke === "ring") continue
    if (role === "hold" && P.stroke === "held") {
      if (C.heavy) { strike.swell = Math.max(1, c.len - 0.6); C.play(tones, c.t + 0.05, f, a * 0.8, 0, size(f)); strike.swell = 0 }
      else if (C.sustained) C.play(tones, c.t + 0.05, f, a * 0.6, 0, 1, Math.max(0.8, c.len - 0.7))
      else {
        // A soft roll: quick light strokes on the same note, swelling up and fading before the next phase.
        strike.soft = true
        const L = Math.max(0.8, c.len - 0.5)
        for (let u = 0; u < L; u += 0.13 + 0.04 * rand()) C.play(tones, c.t + u, f, a * 0.32 * Math.sin(Math.PI * u / L) ** 1.3 * (0.8 + 0.4 * rand()), (rand() - 0.5) * 0.2, size(f))
        strike.soft = false
      }
      continue
    }
    // The sigh: the 1-second sip is a small, soft top-up, and the long sigh after it is struck softly
    // and a beat late, so it eases in rather than following the sip like a second knock.
    const prev = cues[cues.indexOf(c) - 1], afterSip = role === "out" && prev?.role === "sip"
    strike.soft = P.stroke === "soft" || c.role === "sip" || afterSip
    C.play(tones, t + (afterSip ? 0.22 : 0), f, a * (c.role === "sip" ? 0.5 : role === "hold" ? 0.75 : role === "out" ? 1.1 : 1), pan, size(f))
    strike.soft = false
  }

  // Moments: "Let's start", the finish, and (optionally) the start of each round.
  const chimes = stereo()
  function accent(t0, big = 1) {
    const s = big
    switch (P.accent) {
      case "breaks": {
        // The Breaks extension's chime(): 5 bamboo tubes when it starts, 7 when it's complete (C5–A5).
        const notes = [523.25, 587.33, 659.25, 783.99, 880], count = s > 1 ? 7 : s < 1 ? 3 : 5
        for (let k = 0; k < count; k++) bamboo(chimes, t0 + k * 0.17 + rand() * 0.08, notes[Math.floor(rand() * notes.length)], 0.07 * (1 - k / (count + 2)), rand() * 1.2 - 0.6)
        break
      }
      case "bamboo": {
        const notes = [523.25, 587.33, 659.25, 783.99, 880], count = Math.round(6 * s) + (s > 1 ? 1 : 0)
        for (let k = 0; k < count; k++) bamboo(chimes, t0 + k * 0.17 + rand() * 0.08, notes[Math.floor(rand() * notes.length)], 0.07 * s * (1 - k / (count + 2)), rand() * 1.2 - 0.6)
        break
      }
      case "koshi": {
        const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]
        for (let k = 0, n = Math.round(7 * s); k < n; k++) koshiRod(chimes, t0 + k * 0.13 + rand() * 0.1, notes[Math.floor(rand() * notes.length)], 0.045 * s * (1 - k / (n + 3)), rand() * 1.4 - 0.7)
        break
      }
      case "bowl": bowl(chimes, t0, 130.81, 0.09 * s, 0, 1.2); break
      case "gong": gong(chimes, t0, 0.06 * s, 0, 87.31); break                  // F2, the Breaks key
      case "gonglarge": bigGong(chimes, t0, 0.07 * s, 0, 43.65); break        // F1
      // One strike of the big bell; the finish rings it twice, as you would leaving a temple.
      case "templebell": templeBell(chimes, t0, 220, 0.07 * s, 0, 1.3); if (s > 1) templeBell(chimes, t0 + 3.2, 220, 0.045 * s, 0, 1.3); break
      case "crystal": crystal(chimes, t0, 130.81, 0.07 * s, -0.2, 1.1); crystal(chimes, t0 + 0.3, 196, 0.05 * s, 0.2, 1.1); break
      case "rainstick": rainstick(chimes, t0 - 0.4, 0.05 * s, 2.4); break
      case "tingsha": tingsha(chimes, t0, 0.05 * s); if (s >= 1) tingsha(chimes, t0 + 1.6, 0.035 * s); break
      case "windchime": {
        // A breeze through a set of long metal wind chimes: overlapping, slow, ringing.
        const notes = [392, 440, 523.25, 587.33, 659.25, 783.99]
        for (let k = 0, n = Math.round(9 * s); k < n; k++) chimeBar(chimes, t0 + k * 0.22 + rand() * 0.15, notes[Math.floor(rand() * notes.length)], 0.04 * s * (1 - k / (n + 4)), rand() * 1.6 - 0.8)
        break
      }
      case "harp": [174.61, 220, 261.63, 329.63, 440, 523.25, 659.25, 880].forEach((f, k) => harp(chimes, t0 + k * 0.07, f, 0.05 * s, -0.6 + k * 0.17)); break
      case "tongue": [349.23, 440, 523.25, 659.25].forEach((f, k) => tongue(chimes, t0 + k * 0.32, f, 0.08 * s * (1 - k * 0.12), k % 2 ? 0.25 : -0.25)); break
      case "vibes": [174.61, 220, 261.63, 329.63].forEach((f, k) => vibes(chimes, t0 + k * 0.05, f, 0.05 * s, -0.3 + k * 0.2)); break
      case "musicbox": [523.25, 659.25, 783.99, 659.25, 1046.5].forEach((f, k) => musicbox(chimes, t0 + k * 0.26, f, 0.06 * s, k % 2 ? 0.2 : -0.2)); break
    }
  }
  const startAt = spec.chimeAt ?? lineAt("Let's start.")
  if (startAt != null) accent(startAt + 0.05)
  accent(guideEnd + 0.15, 1.15)
  if (P.markRounds) for (let r = 1; r < spec.rounds; r++) accent(guideAt + r * cycle - 0.1, 0.55)

  const foley = stereo()
  if (W?.peek && app) { bamboo(foley, W.peek.in + 0.25, 783.99, 0.07, -0.5); bamboo(foley, W.peek.in + 0.42, 1046.5, 0.04, -0.45) }
  else if (W?.peek) { droplet(foley, W.peek.in + 0.25, 880, 0.16, -0.5); droplet(foley, W.peek.in + 0.42, 1240, 0.08, -0.45) }
  steps.forEach((t, k) => thump(foley, t, 0.11, (spec.mirror ? -1 : 1) * (0.35 - 0.3 * (k / Math.max(1, steps.length - 1))) + (k % 2 ? 0.08 : -0.08)))
  if (W) {
    thump(foley, W.walk + 0.22, 0.07, 0)                                                   // feet together
    for (const k of [0.3, 0.6, 0.9]) thump(foley, sitAt + k, 0.035, 0, { len: 0.12, f: 120, fc: 900, attack: 0.03 })  // robe rustle
    thump(foley, sitAt + 1.35, 0.14, 0, { len: 0.16, f: 70, fc: 260, attack: 0.02 })     // cushion puff
  }

  // Bowls, gongs and crystal ring long, so they get a slightly bigger room.
  const longRing = ["bowl", "crystal", "gong", "gonglarge", "templebell", "windchime"]
  reverb(tones, longRing.includes(P.cue) ? 0.34 : 0.28); reverb(chimes, longRing.includes(P.accent) ? 0.4 : 0.35); reverb(foley, 0.12)

  // Level matching: a layer swapped from the look's default is scaled to the default's loudness
  // (RMS measured on the current mixes), so changing palette changes the character, not the volume.
  const TARGET = { bed: app ? 0.028 : 0.04, pad: 0.0075, cues: app ? 0.0168 : 0.0208, chimes: 0.008 }
  const DEFAULT = { bed: app ? "air" : "ocean", pad: "warm", cues: "kalimba", chimes: "bamboo" }
  const chosen = { bed: P.bed, pad: P.pad, cues: P.cue, chimes: P.accent }, EXACT = new Set(["breaks", "fmaj7"])
  for (const [k, buf] of Object.entries({ bed, pad, cues: tones, chimes })) {
    // Cues are always matched: the default cue's shape changed after TARGET was measured.
    if ((chosen[k] === DEFAULT[k] && k !== "cues") || chosen[k] === "none") continue
    // The Breaks extension's sounds keep the extension's own levels (they are H4's original mix).
    if (EXACT.has(chosen[k]) || (k === "bed" && chosen[k] === "air" && P.cue === "breaks")) continue
    let s = 0, n = 0
    for (const ch of buf) for (let i = 0; i < N; i += 4) { s += ch[i] * ch[i]; n++ }
    const r = Math.sqrt(s / n)
    if (r <= 1e-6) continue
    let g = Math.min(8, TARGET[k] / r), peak = 0
    for (const ch of buf) for (let i = 0; i < N; i += 2) peak = Math.max(peak, Math.abs(ch[i]))
    if (k === "cues" || k === "chimes") g = Math.min(g, 0.24 / Math.max(peak, 1e-6))   // short, clicky sounds stay gentle
    for (const ch of buf) for (let i = 0; i < N; i++) ch[i] *= g
  }

  return { SR, N, duration, guideAt, guideEnd, cycle, phases, stems: { bed, pad, cues: tones, chimes, foley } }
}
