// Starting timelines for the Studio. Times are in seconds.
// Breathing set: "clips" switch the app mode at `at` (welcome, guiding, rest,
// own, hands, finish, paused). Prep set: "events" fire cues and pose changes.
// Either set may add "keys": additive keyframes on any rig parameter.

export const PRESETS = {
  "Breathing · Box session (welcome → 2 rounds → finish)": {
    set: "breathing", duration: 41,
    clips: [{ at: 0, mode: "welcome" }, { at: 4, mode: "guiding", exercise: "box" }, { at: 36, mode: "finish" }]
  },
  "Breathing · Long exhale 4 / 6": {
    set: "breathing", duration: 38,
    clips: [{ at: 0, mode: "welcome" }, { at: 4, mode: "guiding", exercise: "long_exhale" }, { at: 34, mode: "finish" }]
  },
  "Breathing · Physiological sigh (in, sip, long out, rest)": {
    set: "breathing", duration: 24,
    clips: [{ at: 0, mode: "guiding", exercise: "physiological_sigh" }]
  },
  "Breathing · Humming": {
    set: "breathing", duration: 20,
    clips: [{ at: 0, mode: "guiding", exercise: "humming" }]
  },
  "Breathing · Belly (hands rise with the belly)": {
    set: "breathing", duration: 20,
    clips: [{ at: 0, mode: "hands" }, { at: 3.4, mode: "guiding", exercise: "belly" }]
  },
  "Breathing · Custom breath pattern": {
    set: "breathing", duration: 24,
    clips: [{ at: 0, mode: "guiding", pattern: [{ role: "in", seconds: 3 }, { role: "hold", seconds: 1 }, { role: "out", seconds: 5 }, { role: "hold", seconds: 1 }] }]
  },
  "Breathing · Hello and goodbye": {
    set: "breathing", duration: 10,
    clips: [{ at: 0, mode: "welcome" }, { at: 4.5, mode: "rest" }, { at: 5.5, mode: "finish" }]
  },
  "Breathing · Idle rest loop (61 s)": {
    set: "breathing", duration: 61,
    clips: [{ at: 0, mode: "rest" }]
  },
  "Breathing · Custom keys: laugh, look up, nod": {
    set: "breathing", duration: 8,
    clips: [{ at: 0, mode: "rest" }],
    keys: [
      { t: 0.5, calm: 0, look: 0, cheeks: 0, smile: 0, head: 0 },
      { t: 1.4, calm: -1, look: 1, cheeks: 0.7, smile: 0.5 },
      { t: 2.2, head: 0.9 }, { t: 2.8, head: 0 }, { t: 3.4, head: 0.9 },
      { t: 4.2, calm: -1, look: 1, cheeks: 0.7, smile: 0.5, head: 0 },
      { t: 5.2, calm: 0, look: 0, cheeks: 0, smile: 0 }
    ]
  },
  "Prep · Drink two glasses": {
    set: "prep", duration: 24, pose: "glass-hold",
    events: [
      { at: 0.2, cue: "greet" },
      { at: 5, cue: "sip", sip: "glass-sip", then: "glass-rest" },
      { at: 13, pose: "glass-hold" },
      { at: 16, cue: "sip", sip: "glass-sip", then: "glass-rest" }
    ]
  },
  "Prep · Ready, then pick up the glass": {
    set: "prep", duration: 10, pose: "prep-ready",
    events: [{ at: 0.2, cue: "greet" }, { at: 5, pose: "glass-hold" }]
  },
  "Prep · Ease breath (paused, feeling unwell)": {
    set: "prep", duration: 15, pose: "ease-breath",
    events: [{ at: 0, wake: true }]
  },
  "Prep · All done: eyes-smile with the finish nod": {
    set: "prep", duration: 8, pose: "eyes-smile",
    events: [{ at: 0.4, cue: "finish" }]
  },
  "Prep · Dose marked done (all-recorded)": {
    set: "prep", duration: 10, pose: "all-recorded", events: [{ at: 0, wake: true }]
  },
  "Prep · Lively idle that never settles": {
    set: "prep", duration: 30, pose: "glass-hold", livelyMs: 1e12, events: []
  }
}
