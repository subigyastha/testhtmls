// Every sound option and preset the studio offers, in one place. Used by portal.mjs (the lists),
// sound-library.mjs (pre-rendered previews) and palette-samples.mjs. The sounds themselves live
// in audio-core.mjs. flag: strongly tied to Buddhist or Hindu practice (CHARACTER.md avoids
// religious items next to a Budai-style monk), so offered as tests.

export const SOUND_OPTIONS = {
  bed: [
    ["ocean", "Ocean"], ["air", "Air"], ["rain", "Rain"], ["stream", "Forest stream"], ["forest", "Forest wind & birds"],
    ["night", "Night crickets"], ["fire", "Fireside"], ["pink", "Pink noise"], ["brown", "Brown noise"], ["none", "None"]
  ],
  cue: [
    ["breaks", "Breaks extension kalimba (E→A · C · A→E)"], ["kalimba", "Kalimba"], ["bowl", "Singing bowl", "flag"], ["gong", "Gong", "flag"], ["gonglarge", "Large gong", "flag"], ["templebell", "Nepalese temple bell", "flag"], ["crystal", "Crystal bowl"], ["handpan", "Handpan"],
    ["tongue", "Steel tongue drum"], ["piano", "Soft piano"], ["marimba", "Marimba"], ["vibes", "Vibraphone"], ["harp", "Harp"],
    ["glass", "Glass harmonica"], ["musicbox", "Music box"], ["flute", "Bamboo flute"], ["chime", "Meditation chime"],
    ["koshi", "Koshi chimes"], ["wood", "Wood tones"]
  ],
  accent: [
    ["breaks", "Breaks extension bamboo chimes"], ["bamboo", "Bamboo chimes"], ["koshi", "Koshi chimes"], ["windchime", "Wind chimes"], ["bowl", "Singing bowl", "flag"], ["gong", "Gong", "flag"], ["gonglarge", "Large gong", "flag"],
    ["templebell", "Nepalese temple bell", "flag"], ["crystal", "Crystal bowls"], ["harp", "Harp glissando"], ["tongue", "Tongue drum"], ["vibes", "Vibraphone chord"],
    ["musicbox", "Music box"], ["rainstick", "Rainstick"], ["tingsha", "Tingsha", "flag"], ["none", "None"]
  ],
  // How the breath cues are played (see audio-core.mjs). Independent of presets.
  stroke: [["tune", "Breaks tune · E→A in, C hold, A→E out (the extension's melody)"], ["single", "Single stroke · small in, middle hold, big out"], ["soft", "Single stroke · soft felt mallet"], ["ring", "Strokes on in & out · hold rings on"],
    ["held", "Single stroke · soft roll on hold"], ["figure", "Note runs (earlier version)"]],
  pad: [["fmaj7", "Breaks extension Fmaj7 pad"], ["warm", "Warm pad"], ["tanpura", "Tanpura", "flag"], ["shruti", "Shruti box", "flag"], ["crystal", "Crystal-bowl drone"], ["deep", "Deep drone"], ["none", "None"]]
}

export const LAYER_LABEL = { bed: "Bed", cue: "Breath cues", stroke: "Stroke", accent: "Moments (start · finish)", pad: "Drone" }

// "look" = the look's own sound (H3: ocean, kalimba, bamboo, warm pad; H4: air instead of ocean).
export const SOUND_PRESETS = [
  ["look", "The look's own sound", null],
  // The Breaks extension, exactly: its defaults (cues + chimes), and with its optional ambience on.
  ["breaks", "Breaks extension · cues + chimes", { bed: "none", cue: "breaks", accent: "breaks", pad: "none", markRounds: false }],
  ["breaksamb", "Breaks extension · with ambience", { bed: "air", cue: "breaks", accent: "breaks", pad: "fmaj7", markRounds: false }],
  ["bowls", "Singing bowls", { bed: "air", cue: "bowl", accent: "bowl", pad: "warm", markRounds: true }, "flag"],
  ["gongbath", "Gong bath", { bed: "none", cue: "gong", accent: "gong", pad: "deep", markRounds: false }, "flag"],
  ["biggong", "Large gong bath", { bed: "none", cue: "gonglarge", accent: "gonglarge", pad: "deep", markRounds: false }, "flag"],
  ["temple", "Temple bell & bowls", { bed: "air", cue: "bowl", accent: "templebell", pad: "warm", markRounds: true }, "flag"],
  ["gong", "Gong & bowl", { bed: "none", cue: "bowl", accent: "gong", pad: "tanpura", markRounds: true }, "flag"],
  ["crystal", "Crystal bowls", { bed: "none", cue: "crystal", accent: "crystal", pad: "crystal", markRounds: false }],
  ["handpan", "Handpan & rain", { bed: "rain", cue: "handpan", accent: "koshi", pad: "warm", markRounds: false }],
  ["tongue", "Tongue drum & stream", { bed: "stream", cue: "tongue", accent: "tongue", pad: "none", markRounds: false }],
  ["piano", "Soft piano & rain", { bed: "rain", cue: "piano", accent: "koshi", pad: "none", markRounds: false }],
  ["stream", "Forest stream & koshi chimes", { bed: "stream", cue: "koshi", accent: "rainstick", pad: "none", markRounds: false }],
  ["forest", "Forest wind & harp", { bed: "forest", cue: "harp", accent: "windchime", pad: "warm", markRounds: false }],
  ["focus", "Focus · pink noise & glass", { bed: "pink", cue: "glass", accent: "windchime", pad: "deep", markRounds: false }],
  ["night", "Night & tanpura", { bed: "night", cue: "chime", accent: "tingsha", pad: "tanpura", markRounds: false }, "flag"],
  ["fire", "Fireside & wood", { bed: "fire", cue: "wood", accent: "bamboo", pad: "warm", markRounds: false }]
]
