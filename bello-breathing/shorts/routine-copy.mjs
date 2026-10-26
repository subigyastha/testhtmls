// Video copy per routine (routines.mjs is a straight copy of the extension's file, so the video-only
// copy lives here): how the intro names each routine in "Let me guide you through …".
export const INTRO_NAME = { comfortable: "comfortable breathing", long_exhale: "a long, slow out-breath", belly: "belly breathing", humming: "humming breath",
  sigh: "the physiological sigh", eyes: "an eye-rest minute", breath_478: "4-7-8 breathing", box: "box breathing" }

// Hook lines (first screen) the studio offers. "{X}" is filled from HOOK_TOPICS (or typed).
// Relatable only: none of these says breathing treats constipation, IBS or anything else.
export const HOOKS = ["Is stress bothering you?", "Stomach in knots?", "Belly feeling unsettled?", "Ever tried humming to your tummy?",
  "Tense belly before a big moment?", "Rushed meal? Give your belly a minute.", "{X} giving you stress?"]
export const HOOK_TOPICS = ["Constipation", "Bloating", "Your gut", "Your tummy", "IBS", "Indigestion", "Gas"]
export const fillHook = (h, x) => h.replace("{X}", x.trim() ? x.trim()[0].toUpperCase() + x.trim().slice(1) : "Your gut")

// Video-only timing (routines.mjs stays a straight copy of the extension). Physiological sigh: the
// user chose a 2-second top-up breath ("A little more") for the videos; the extension keeps 1 s.
export const VIDEO_SECONDS = { sigh: { sip: 2 } }
export const videoPattern = (id, R) => Object.entries(VIDEO_SECONDS[id] || {}).reduce((s, [role, sec]) =>
  s.replace(`${role} ${R.phases.find(p => p.role === role)?.seconds}`, `${role} ${sec}`), R.pattern)
