// Mascot Animation Kit: deterministic motion baker.
//
// The app drives the Buddha from a live requestAnimationFrame loop. For video
// we need the same motion, but frame-exact and repeatable, so this module
// replays the app's motion logic on a fixed clock (1 / fps per step) and
// returns one record per frame: the rig parameters plus which art layers to
// blend. Nothing here draws; see studio.mjs for rendering.
//
// Two character sets, matching the two places the app animates him:
//
//   "breathing"  public/box-breathing/v2/buddha/character.mjs (+ poses.mjs)
//                One body, four expression textures (laugh, calm, exhale,
//                eyes-open) blended by the calm / exhale / look parameters.
//
//   "prep"       public/prep-drinking/v1/motion/character.mjs
//                Seven pose textures (glass-hold, glass-sip, ...) crossfaded
//                inside one warped body, driven by cues (greet, sip, finish).
//
// Both share rig/rig.mjs (the mesh warp) and the same critically damped
// spring on the joints. rig/*.mjs are byte-for-byte copies of the frozen
// package, except the "?v=46" cache-busting query was removed from imports.

import { clamp, ease, mix } from "./rig/rig.mjs"
import { poseFor, mixPose, followPose } from "./rig/poses.mjs"

export const PARAMS = ["breath", "calm", "exhale", "hum", "look", "head", "tilt", "hands", "gather", "shoulders", "sway", "greet", "brow", "squint", "focus", "release", "cheeks", "smile", "nose", "lipSeal"]

export const BREATHING_TEXTURES = ["buddha-hd-laugh", "buddha-hd-calm", "buddha-hd-exhale", "buddha-hd-eyes"]
export const PREP_POSES = ["prep-ready", "glass-hold", "glass-sip", "glass-rest", "ease-breath", "all-recorded", "eyes-smile"]

// Source-pixel nudges of the 1205 x 1306 prep masters (VisitRoutineHelper::ROUTINE_OFFSETS).
export const OFFSETS = {
  "prep-ready": [5, -4], "glass-hold": [2, 0], "glass-sip": [-1, 8], "glass-rest": [-62, 32],
  "ease-breath": [-32, 19], "all-recorded": [-54, 16], "eyes-smile": [0, 0]
}

// Breathing exercises as the engine defines them (app/javascript/utils/box_breathing_engine.js).
export const EXERCISES = {
  box: { phases: [4, 4, 4, 4], roles: ["in", "hold", "out", "hold"] },
  long_exhale: { phases: [4, 0, 6, 0], roles: ["in", "hold", "out", "hold"] },
  steady: { phases: [5, 0, 5, 0], roles: ["in", "hold", "out", "hold"] },
  belly: { phases: [5, 0, 5, 0], roles: ["in", "hold", "out", "hold"], belly: true },
  humming: { phases: [4, 0, 6, 0], roles: ["in", "hold", "out", "hold"], humming: true },
  four_seven_eight: { phases: [4, 7, 8, 0], roles: ["in", "hold", "out", "hold"] },
  physiological_sigh: { phases: [3, 1, 6, 10], roles: ["in", "sip", "out", "natural"], sigh: true }
}

const pulse = (t, start, length) => Math.sin(Math.PI * clamp((t - start) / length)) ** 2

// ---------------------------------------------------------------- custom keys
// Optional additive keyframes on top of the app motion:
//   "keys": [{ "t": 2, "head": 0 }, { "t": 3, "head": 0.8 }, { "t": 4, "head": 0 }]
// Values ease (smootherstep) between keys and hold past the first / last key.
function keyLayer(keys = []) {
  const tracks = {}
  for (const key of [...keys].sort((a, b) => a.t - b.t)) {
    for (const [name, value] of Object.entries(key)) if (name !== "t") (tracks[name] ||= []).push([key.t, value])
  }
  return t => {
    const out = {}
    for (const [name, track] of Object.entries(tracks)) {
      if (t <= track[0][0]) { out[name] = track[0][1]; continue }
      const last = track[track.length - 1]
      if (t >= last[0]) { out[name] = last[1]; continue }
      for (let i = 1; i < track.length; i++) {
        const [t0, v0] = track[i - 1], [t1, v1] = track[i]
        if (t <= t1) { out[name] = mix(v0, v1, ease((t - t0) / (t1 - t0 || 1))); break }
      }
    }
    return out
  }
}
const addKeys = (p, extra) => { for (const [k, v] of Object.entries(extra)) p[k] = (p[k] || 0) + v; return p }

// ------------------------------------------------------------ breathing set
const breathingLevel = (role, progress, sigh) =>
  role === "in" ? ease(progress) * (sigh ? 0.72 : 1) : role === "sip" ? 0.72 + 0.28 * ease(progress) : role === "out" ? 1 - ease(progress) : 0

function guidingFrame(clip, local) {
  const exercise = EXERCISES[clip.exercise] || {}
  const pattern = clip.pattern || (exercise.roles || []).map((role, i) => ({ role, seconds: exercise.phases[i] }))
  const phases = pattern.filter(phase => phase.seconds > 0)
  const cycle = phases.reduce((sum, phase) => sum + phase.seconds, 0)
  if (!cycle) return { mode: "rest" }
  let offset = local % cycle, index = 0
  while (offset >= phases[index].seconds) { offset -= phases[index].seconds; index++ }
  const phase = phases[index], progress = offset / phase.seconds
  const sigh = clip.sigh ?? exercise.sigh ?? phases.some(p => p.role === "sip")
  let breath
  if (phase.role === "hold") {
    // A hold after the out-breath is an empty hold; otherwise full.
    const before = phases[(index - 1 + phases.length) % phases.length].role
    breath = phase.level ?? (before === "out" ? 0 : 1)
  } else breath = breathingLevel(phase.role, progress, sigh)
  const humming = clip.humming ?? exercise.humming ?? false
  return {
    mode: phase.role === "natural" ? "rest" : "guiding", role: phase.role, progress, breath,
    belly: clip.belly ?? exercise.belly ?? false, humming,
    via: humming || ["in", "sip"].includes(phase.role) ? "nose" : "mouth",
    phase: { seconds: phase.seconds }, offset
  }
}

function breathingFrameAt(clip, local) {
  if (!clip) return { mode: "rest" }
  if (clip.mode === "guiding") return guidingFrame(clip, local)
  return { mode: clip.mode, elapsed: local }
}

// Replays character.mjs paint(): a 500 ms (850 ms into pause) blend whenever
// the mode changes, then the joint spring.
function bakeBreathing(timeline, fps) {
  const clips = [...(timeline.clips || [])].sort((a, b) => a.at - b.at)
  const keys = keyLayer(timeline.keys), dt = 1 / fps, count = Math.round(timeline.duration * fps)
  let lastPose = poseFor({ motion: false }), previousMode = "", transition = null, scene = 0, modeSeconds = 0
  const velocity = {}, frames = []
  for (let i = 0; i <= count; i++) {
    const t = i * dt, step = i ? dt : 0
    const clip = clips.filter(c => c.at <= t).pop()
    const f = breathingFrameAt(clip, clip ? t - clip.at : 0), mode = f.mode
    if (mode !== "paused") scene += step
    if (mode !== previousMode) { previousMode = mode; modeSeconds = 0; transition = { from: lastPose, elapsed: 0, duration: mode === "paused" ? 850 : 500 } }
    else { if (mode !== "paused") modeSeconds += step; if (transition) transition.elapsed += step * 1000 }
    let p = poseFor(f, modeSeconds, scene)
    if (transition) { p = mixPose(transition.from, p, transition.elapsed / transition.duration); if (transition.elapsed >= transition.duration) transition = null }
    p = followPose(lastPose, addKeys(p, keys(t)), velocity, step)
    lastPose = p
    frames.push({ t, p: { ...p }, mode, role: f.role || "", layers: { calm: clamp(p.calm), exhale: clamp(p.exhale || 0), look: clamp(p.look || 0) } })
  }
  return frames
}

// ----------------------------------------------------------------- prep set
// Copied from public/prep-drinking/v1/motion/character.mjs (unexported there).
const LIVELY_MS = 90000, SETTLE_MS = 4000, SIP_SECONDS = 4.1, POSE_SECONDS = 0.7, ARRIVE_SECONDS = 4.2
const ZERO = Object.fromEntries(PARAMS.map(k => [k, 0]))

function restBreath(seconds, period) {
  const t = (seconds % period) / period
  return t < 0.42 ? ease(t / 0.42) : 1 - ease((t - 0.42) / 0.58)
}

function idlePose(seconds, energy) {
  const p = { ...ZERO }
  const b = restBreath(seconds, mix(6.4, 5.6, energy)) * mix(0.30, 0.42, energy)
  const life = seconds % 61, glance = pulse(life, 8, 3.6) + pulse(life, 46, 3.2)
  p.breath = b
  p.shoulders = 0.55 * b
  p.head = -0.45 * b + energy * 0.25 * (pulse(life, 1.1, 2.3) + pulse(life, 29, 2.8))
  p.brow = 0.2 * b
  p.sway = energy * (0.10 * Math.sin(seconds / 8.7) + 0.045 * Math.sin(seconds / 4.3))
  p.tilt = energy * (0.38 * pulse(life, 8, 3.6) - 0.28 * pulse(life, 46, 3.2))
  p.cheeks = energy * 0.26 * glance
  p.smile = energy * 0.22 * glance
  return p
}

function sipPose(age, base) {
  const p = { ...base }
  const blend = ease((age - 0.45) / 0.5) * (1 - ease((age - 2.45) / 0.5))
  p.head += 0.3 * pulse(age, 0, 0.6) - 0.55 * blend + 0.75 * pulse(age, 2.95, 0.9)
  p.tilt += -0.18 * blend + 0.4 * pulse(age, 2.95, 1.1)
  p.brow += 0.45 * blend
  p.cheeks += 0.25 * blend + 0.7 * pulse(age, 2.9, 1.2)
  p.smile += 0.5 * pulse(age, 2.9, 1.2)
  return { pose: p, mix: blend }
}

function arrivePose(age, base, finish) {
  const p = { ...base }
  p.head += finish ? 0.84 * pulse(age, 0.3, 1.5) : 0.8 * pulse(age, 0.45, 1.5) - 0.24 * pulse(age, 2.2, 2)
  p.tilt += finish ? 0.82 * pulse(age, 0.6, 2.8) : 0.9 * pulse(age, 0.15, 2.5) - 0.22 * pulse(age, 3.8, 2.5)
  p.brow += 0.66 * pulse(age, 0.25, 2.3)
  p.cheeks += 0.74 * pulse(age, 0.4, 2.7)
  p.smile += 0.52 * pulse(age, 0.4, 2.7)
  return p
}

function bakePrep(timeline, fps) {
  const events = [...(timeline.events || [])].sort((a, b) => a.at - b.at)
  const lively = timeline.livelyMs ?? LIVELY_MS
  const keys = keyLayer(timeline.keys), dt = 1 / fps, count = Math.round(timeline.duration * fps)
  const state = { pose: timeline.pose || "glass-hold", from: null, poseAt: 0, cue: null, cueAt: 0, sip: "glass-sip", then: null, wakeAt: 0 }
  let clock = 0, prev = { ...ZERO }, next = 0
  const velocity = {}, frames = []

  const startPose = name => {
    if (name === state.pose || !PREP_POSES.includes(name)) return
    state.from = state.pose; state.pose = name; state.poseAt = clock; state.wakeAt = clock
  }
  function frame() {
    const energy = 1 - ease(((clock - state.wakeAt) * 1000 - lively) / SETTLE_MS)
    let p = idlePose(clock, energy), a = state.pose, b = null, amount = 0
    if (state.cue) {
      const age = clock - state.cueAt
      if (state.cue === "sip" && age < SIP_SECONDS) {
        const sip = sipPose(age, p); p = sip.pose; b = state.sip; amount = sip.mix
      } else if ((state.cue === "greet" || state.cue === "finish") && age < ARRIVE_SECONDS) {
        p = arrivePose(age, p, state.cue === "finish")
      } else {
        const then = state.cue === "sip" && state.then
        state.cue = null; state.then = null
        if (then) startPose(then)
      }
    }
    if (state.from && !b) {
      const age = clock - state.poseAt
      if (age < POSE_SECONDS) {
        a = state.from; b = state.pose; amount = ease(age / POSE_SECONDS)
        p.head += 0.35 * pulse(age, 0, POSE_SECONDS + 0.3); p.brow += 0.3 * pulse(age, 0.2, POSE_SECONDS)
      } else state.from = null
    }
    return { p, a, b, amount, energy }
  }
  // The prep character springs only these four joints.
  function follow(target, step) {
    const p = { ...target }
    for (const key of ["head", "tilt", "shoulders", "sway"]) {
      const rate = 21, z = (prev[key] || 0) - target[key], v = velocity[key] || 0, j = v + rate * z, e = Math.exp(-rate * step)
      p[key] = target[key] + (z + j * step) * e; velocity[key] = (v - rate * j * step) * e
    }
    return p
  }

  for (let i = 0; i <= count; i++) {
    const t = i * dt, step = i ? dt : 0
    clock += step
    while (next < events.length && events[next].at <= t + 1e-9) {
      const e = events[next++]
      if (e.cue) Object.assign(state, { cue: e.cue, cueAt: clock, sip: e.sip || "glass-sip", then: e.then || null, from: null, wakeAt: clock })
      else if (e.pose) { state.cue = null; state.then = null; startPose(e.pose) }
      else if (e.wake) state.wakeAt = clock
    }
    const f = frame()
    prev = follow(addKeys(f.p, keys(t)), step)
    frames.push({ t, p: { ...prev }, energy: f.energy, layers: { a: f.a, b: f.b, amount: f.b ? clamp(f.amount) : 0 } })
  }
  return frames
}

export function bake(timeline, fps = 30) {
  return timeline.set === "prep" ? bakePrep(timeline, fps) : bakeBreathing(timeline, fps)
}

// One row per frame, for driving the same motion in another tool.
export function toCSV(frames, set) {
  const extra = set === "prep" ? ["textureA", "textureB", "textureMix"] : ["mode", "role"]
  const rows = [["frame", "time", ...PARAMS, ...extra].join(",")]
  frames.forEach((f, i) => {
    const tail = set === "prep" ? [f.layers.a, f.layers.b || "", f.layers.amount.toFixed(4)] : [f.mode, f.role]
    rows.push([i, f.t.toFixed(4), ...PARAMS.map(k => (f.p[k] || 0).toFixed(5)), ...tail].join(","))
  })
  return rows.join("\n")
}
