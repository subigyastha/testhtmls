// COPY of the Breaks extension's routine library (D:/Gutsphere/Gutsphere_Breaks_Prototype_v0_1_1/
// gutsphere-breaks/extension/routines.mjs), so the videos and the extension guide the same routines.
// Keep in sync by copying the file again; the studio reads ROUTINES, ROUTINE_ORDER and PREVIEW_ORDER.

// The routine library. Adding a routine = adding one entry here (plus any new voice lines in voice/).
// Everything else (picker, player, guide text, Bello, sound, history) reads from this data.
//
// Each routine:
//   name, short       full name for history; short name for the picker
//   pattern           one-line rhythm shown in the picker, at standard pace
//   phases            [{role, seconds, label, cue, voice}] at standard pace. role: 'in' | 'sip' | 'hold' | 'out'
//                     (drives Bello, the wave, air ribbons and sound). 'sip' is a short top-up breath after
//                     an 'in'. voice: a clip id in voice/. Optional per phase:
//                       to      lung level an 'in' reaches (default 1; the sigh's first breath stops at .8)
//                       hum     Bello hums with lips together, and a soft hum tone plays with the cues
//   belly             Bello's hands rest higher on his belly
//   fixedPace         the timings are the routine (4-7-8): the pace choice doesn't apply
//   preview           awaiting clinical approval: hidden unless "Show routines awaiting approval" is on
//   wholeRounds       end on a complete round (rounds up the chosen length)
//   guide             the "Before you begin" rhythm sentence; {in} {hold} {out} become seconds at the chosen pace
//   caution           extra safety line, when the routine needs one
//   gut               for "My gut focus" and "Why this routine?":
//                       conditions  tags, see CONDITIONS
//                       evidence    'gut' tested in gut patients · 'indirect' tested for stress, not gut symptoms
//                                   · 'theory' based on how the body works, no direct study
//                       why         one plain sentence; "may help", never "treats"
//                       sources     [{label, url}]
//                       byCondition optional {condition: evidence} where it differs from `evidence`
//   review            'draft' until the clinical/content reviewer approves the copy and the gut claims
//   version           stored on history records
//
// Gut data comes from the "Self-care routines categorization" research (22 Oct 2026). Draft, not reviewed.

export const CONDITIONS = {
  stress: 'Stress and the gut', ibs: 'IBS', 'ibs-c': 'IBS with constipation', constipation: 'Constipation',
  reflux: 'Reflux / GERD', dyspepsia: 'Indigestion (functional dyspepsia)', bloating: 'Bloating',
};

export const EVIDENCE = {
  gut: 'Tested in people with gut symptoms',
  indirect: 'Tested for stress, not gut symptoms',
  theory: 'Based on how the body works; no direct study yet',
};

export const ROUTINES = {
  comfortable: {
    name: 'Comfortable breathing', short: 'Comfortable', pattern: 'in 4 · out 4 · no holds', version: 'draft-1', wholeRounds: false,
    phases: [
      {role: 'in', seconds: 4, label: 'Breathe in', cue: 'Comfortable, unforced breaths.', voice: 'in'},
      {role: 'out', seconds: 4, label: 'Breathe out', cue: 'An easy breath out.', voice: 'out'},
    ],
    guide: 'Bello breathes in for {in} seconds and out for {out}. Follow only if comfortable. There are no breath holds.',
    gut: {
      conditions: ['stress'], evidence: 'indirect',
      why: 'Slow, easy breathing helps the body settle, and stress and the gut are closely connected.',
      sources: [{label: 'Albulescu et al. 2022, micro-breaks meta-analysis', url: 'https://doaj.org/article/c6f37b6ba159469296b2cb968b65505f'}],
    },
    review: 'draft',
  },

  long_exhale: {
    name: 'Long exhale', short: 'Long exhale', pattern: 'in 4 · out 6 · no holds', version: 'draft-1', wholeRounds: true,
    phases: [
      {role: 'in', seconds: 4, label: 'Breathe in', cue: 'Through your nose.', voice: 'in'},
      {role: 'out', seconds: 6, label: 'Breathe out slowly', cue: 'Let the out-breath be longer.', voice: 'out'},
    ],
    guide: 'Bello breathes in for {in} seconds and out slowly for {out}. A longer out-breath, with no holds. If it feels like too much, shorten the out-breath.',
    gut: {
      conditions: ['ibs-c', 'ibs', 'dyspepsia', 'stress'], evidence: 'gut',
      why: 'A longer out-breath helps the body shift into “rest and digest”. In one small trial, breathing at this pace eased IBS-C symptoms.',
      sources: [
        {label: 'Slow breathing in IBS-C, Frontiers 2022', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9673479/'},
        {label: 'Balban et al. 2023, exhale-focused breathing', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947'},
      ],
    },
    review: 'draft',
  },

  belly: {
    name: 'Belly breathing', short: 'Belly', pattern: 'in 5 · out 5 · hand on belly', version: 'draft-1', wholeRounds: true, belly: true,
    phases: [
      {role: 'in', seconds: 5, label: 'Breathe into your belly', cue: 'Let your hand rise.', voice: 'belly_in'},
      {role: 'out', seconds: 5, label: 'Breathe out', cue: 'Let your belly soften.', voice: 'belly_out'},
    ],
    guide: 'Sit upright and rest a hand on your belly. Bello breathes in for {in} seconds, letting the belly rise, and out for {out}, letting it soften. Keep your chest and shoulders quiet. No holds.',
    gut: {
      conditions: ['reflux', 'bloating', 'constipation', 'dyspepsia', 'stress'], evidence: 'gut',
      // The trials were in reflux; for the others the link is indirect or theory.
      byCondition: {bloating: 'indirect', constipation: 'theory', dyspepsia: 'theory', stress: 'indirect'},
      why: 'Breathing low into the belly works the diaphragm, which helps the valve between the stomach and the food pipe stay closed. In small trials, belly breathing eased reflux, including straight after meals.',
      sources: [
        {label: 'Eherer et al. 2012, belly breathing in GERD (RCT)', url: 'https://pubmed.ncbi.nlm.nih.gov/22146488/'},
        {label: 'Halland et al. 2021, after-meal diaphragmatic breathing (RCT)', url: 'https://pubmed.ncbi.nlm.nih.gov/33009052/'},
        {label: 'Barba et al. 2024, diaphragm training for meal-related distension', url: 'https://pubmed.ncbi.nlm.nih.gov/38467383/'},
      ],
    },
    review: 'draft',
  },

  humming: {
    name: 'Humming breath', short: 'Humming', pattern: 'in 4 · hum out 6', version: 'draft-1', wholeRounds: true,
    phases: [
      {role: 'in', seconds: 4, label: 'Breathe in', cue: 'Through your nose.', voice: 'in'},
      {role: 'out', seconds: 6, label: 'Hum as you breathe out', cue: 'A soft “mmm”, lips together.', voice: 'hum', hum: true},
    ],
    guide: 'Bello breathes in for {in} seconds, then hums gently for {out} as he breathes out, lips together. Hum as quietly as you like, or just breathe out slowly if you’re not alone.',
    gut: {
      conditions: ['stress', 'ibs', 'dyspepsia'], evidence: 'theory',
      byCondition: {stress: 'indirect'},
      why: 'Humming makes the out-breath long and gentle, and its soft vibration may help the body settle through the vagus nerve, which links the brain and the gut. It hasn’t been studied for gut symptoms yet.',
      sources: [{label: 'Woo et al. 2025, slow-paced and humming breathing (pilot)', url: 'https://pubmed.ncbi.nlm.nih.gov/40482984/'}],
    },
    review: 'draft',
  },

  sigh: {
    name: 'Physiological sigh', short: 'Sigh', pattern: 'in 3 · sip 1 · out 6', version: 'draft-1', wholeRounds: true,
    phases: [
      {role: 'in', seconds: 3, label: 'Breathe in', cue: 'Through your nose.', voice: 'in', to: 0.8},
      {role: 'sip', seconds: 1, label: 'A little more', cue: 'Top up with a short sniff.', voice: 'sip'},
      {role: 'out', seconds: 6, label: 'Sigh it out', cue: 'Slowly, through your mouth.', voice: 'sigh_out'},
    ],
    guide: 'Bello breathes in through his nose for {in} seconds, takes a short second sniff to top up, then lets it all out in a long, slow sigh of {out} seconds.',
    caution: 'If you feel light-headed, breathe normally for a moment.',
    gut: {
      conditions: ['stress', 'ibs'], evidence: 'indirect',
      byCondition: {ibs: 'theory'},
      why: 'A double breath in and a long sigh out is one of the quickest ways to lower tension. In a month-long study, five minutes a day improved mood more than mindfulness. It hasn’t been studied for gut symptoms.',
      sources: [{label: 'Balban et al. 2023, cyclic sighing (RCT)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947'}],
    },
    review: 'draft',
  },

  eyes: {
    name: 'Eye-rest minute', short: 'Eye rest', pattern: 'look far · blink · breathe', version: 'draft-1', wholeRounds: true,
    phases: [
      {role: 'in', seconds: 4, label: 'Look far away', cue: 'Something across the room or out of a window.', voice: 'eyes_in'},
      {role: 'out', seconds: 6, label: 'Let your eyes soften', cue: 'Blink slowly. Breathe out.', voice: 'eyes_out'},
    ],
    guide: 'Look away from the screen at something at least 6 metres away. Breathe in for {in} seconds, then breathe out for {out}, blinking slowly. A minute away from the screen covers the 20-20-20 rule three times.',
    gut: {
      conditions: ['stress'], evidence: 'theory',
      why: 'Not a gut routine: a screen break for your eyes with an easy, longer out-breath. Regular breaks from the screen are part of easing everyday tension.',
      sources: [{label: 'Talens-Estarelles et al. 2023, testing the 20-20-20 rule', url: 'https://pubmed.ncbi.nlm.nih.gov/35963776/'}],
    },
    review: 'draft',
  },

  breath_478: {
    name: '4-7-8 breathing', short: '4-7-8', pattern: 'in 4 · hold 7 · out 8', version: 'draft-1', wholeRounds: true,
    fixedPace: true, preview: true,
    phases: [
      {role: 'in', seconds: 4, label: 'Breathe in', cue: 'Quietly, through your nose.', voice: 'in'},
      {role: 'hold', seconds: 7, label: 'Hold gently', cue: 'Breathe sooner if you need.', voice: 'hold'},
      {role: 'out', seconds: 8, label: 'Breathe out', cue: 'Slowly, through your mouth, with a soft whoosh.', voice: 'out'},
    ],
    guide: 'Bello breathes in for {in} seconds, holds gently for {hold} and breathes out slowly for {out}.',
    caution: 'Long holds aren’t for everyone. Stop if you feel dizzy or breathless, and check with a clinician first if you’re pregnant or have a heart or lung condition.',
    gut: {
      conditions: ['stress', 'dyspepsia', 'ibs'], evidence: 'indirect',
      byCondition: {dyspepsia: 'theory', ibs: 'theory'},
      why: 'A long hold and an even longer out-breath slow everything down. In one trial, 4-7-8 breathing eased fear and anxiety before an endoscopy.',
      sources: [
        {label: 'Parlak et al. 2026, 4-7-8 before endoscopy (RCT)', url: 'https://pubmed.ncbi.nlm.nih.gov/42715135/'},
        {label: 'Avcık et al. 2026, 4-7-8 crossover study', url: 'https://pubmed.ncbi.nlm.nih.gov/42771122/'},
      ],
    },
    review: 'draft',
  },

  box: {
    name: 'Box breathing', short: 'Box', pattern: 'in 4 · hold 4 · out 4 · hold 4', version: 'draft-1', wholeRounds: true,
    phases: [
      {role: 'in', seconds: 4, label: 'Breathe in', cue: 'Through your nose.', voice: 'in'},
      {role: 'hold', seconds: 4, label: 'Hold gently', cue: 'Breathe sooner if you need.', voice: 'hold'},
      {role: 'out', seconds: 4, label: 'Breathe out', cue: 'An easy breath out.', voice: 'out'},
      {role: 'hold', seconds: 4, label: 'Hold gently', cue: 'Breathe sooner if you need.', voice: 'hold'},
    ],
    guide: 'Bello breathes in for {in} seconds, holds gently for {hold}, breathes out for {out} and rests for {hold}.',
    caution: 'Hold only as long as it feels easy and breathe sooner if you need. If holds are uncomfortable, choose a routine without holds.',
    gut: {
      conditions: ['stress', 'ibs', 'dyspepsia'], evidence: 'indirect',
      why: 'Steady, even breathing calms the stress response, which is one of the main ways the brain and gut affect each other.',
      sources: [{label: 'Balban et al. 2023, breathwork and mood', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947'}],
    },
    review: 'draft',
  },
};

// Picker order.
export const ROUTINE_ORDER = ['comfortable', 'long_exhale', 'belly', 'sigh', 'humming', 'box', 'eyes'];
// Awaiting clinical approval: in the library, but only in the picker when the reviewer preview is on.
export const PREVIEW_ORDER = ['breath_478'];
