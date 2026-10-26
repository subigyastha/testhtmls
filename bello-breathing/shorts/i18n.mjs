// Spanish and Hindi copy for the shorts (draft 1: needs a native-speaker read; the readable version
// is translations/scripts-es-hi.md). English stays where it was (portal.mjs, routine-copy.mjs,
// compose.mjs); each language here mirrors it. Spanish: neutral Latin American, "tú". Hindi: everyday
// spoken Hindi, polite "आप", gender-neutral "चलिए, साथ में…" so it fits any voice.
// Voices: Chatterbox cloning af_nicole (tts-ml/voices.json).

export const LANGS = { en: "English", es: "Español", hi: "हिन्दी" }
export const LANG_VOICE = { es: "es_nicole", hi: "hi_nicole" }

const es = {
  // Same order as HOOKS / HOOK_TOPICS in routine-copy.mjs, so a picked hook carries across languages.
  hooks: ["¿El estrés te está afectando?", "¿Nudo en el estómago?", "¿Sientes la panza revuelta?", "¿Alguna vez le has tarareado a tu pancita?",
    "¿Panza tensa antes de un momento importante?", "¿Comiste con prisa? Dale un minuto a tu panza.", "¿Estrés por {X}?"],
  topics: ["el estreñimiento", "la hinchazón", "tu intestino", "tu pancita", "el colon irritable", "la indigestión", "los gases"],
  intro: { comfortable: "Te guío con una respiración cómoda.", long_exhale: "Te guío con una exhalación larga y lenta.", belly: "Te guío con la respiración abdominal.",
    humming: "Te guío con la respiración con zumbido.", sigh: "Te guío con el suspiro fisiológico.", eyes: "Te guío con un minuto de descanso visual.",
    breath_478: "Te guío con la respiración cuatro, siete, ocho.", box: "Te guío con la respiración cuadrada." },
  start: "Empecemos.", encourage: "Muy bien. Sigue así.", halfway: "Vamos a la mitad.", last: "Última ronda.",
  outroTitle: "¿Cómo te sentiste?", outroCta: "Guárdalo para tu próximo momento ajetreado.",
  done: { h3: "Buen trabajo", app: "Listo por ahora" },
  words: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"],
  rounds: n => `${cap(es.words[n])} rondas`,
  about: (n, secs) => `${n} rondas. ${secs < 50 ? "Medio minuto" : secs < 80 ? "Un minuto" : secs < 110 ? "Un minuto y medio" : "Dos minutos"}, más o menos.`,
  round: "Ronda {r} de {n}",
  ask: "¿Cómo te sientes?", chips: ["Con más calma", "Igual", "Con más tensión", "No sé"],
  labels: {
    h3: { in: "Inhala", hold: "Sostén", out: "Exhala", sip: "Un poquito más", natural: "Respira normal" },
    app: { in: "Inhala", hold: "Sostén suavemente", out: "Exhala", sip: "Un poquito más", natural: "Respira con naturalidad" }
  },
  cues: { in: "Por la nariz.", hold: "Si lo necesitas, respira antes.", out: "Suelta el aire sin esfuerzo.", sip: "Completa con una inhalación corta.", natural: "" },
  // Routine phase labels and cues (routines.mjs English → Spanish).
  phrase: {
    "Breathe in": "Inhala", "Breathe out": "Exhala", "Hold gently": "Sostén suavemente", "Breathe out slowly": "Exhala despacio",
    "Breathe into your belly": "Lleva el aire a tu panza", "Hum as you breathe out": "Exhala tarareando", "A little more": "Un poquito más",
    "Sigh it out": "Suéltalo con un suspiro", "Look far away": "Mira a lo lejos", "Let your eyes soften": "Relaja la mirada",
    "Comfortable, unforced breaths.": "Respiraciones cómodas, sin forzar.", "An easy breath out.": "Suelta el aire sin esfuerzo.",
    "Through your nose.": "Por la nariz.", "Quietly, through your nose.": "En silencio, por la nariz.", "Let the out-breath be longer.": "Que la exhalación dure más.",
    "Let your hand rise.": "Deja que tu mano suba.", "Let your belly soften.": "Deja que tu panza se afloje.",
    "A soft “mmm”, lips together.": "Un “mmm” suave, con los labios juntos.", "Top up with a short sniff.": "Completa con una inhalación corta.",
    "Slowly, through your mouth.": "Despacio, por la boca.", "Slowly, through your mouth, with a soft whoosh.": "Despacio, por la boca, con un suave “fuuu”.",
    "Breathe sooner if you need.": "Si lo necesitas, respira antes.", "Something across the room or out of a window.": "Algo al otro lado del cuarto o por la ventana.",
    "Blink slowly. Breathe out.": "Parpadea despacio. Exhala."
  }
}

const hi = {
  hooks: ["क्या तनाव आपको परेशान कर रहा है?", "पेट में खिंचाव-सा लग रहा है?", "पेट कुछ ठीक नहीं लग रहा?", "कभी अपने पेट के लिए गुनगुनाकर देखा है?",
    "किसी बड़े मौक़े से पहले पेट में बेचैनी?", "जल्दी-जल्दी खाना खाया? अपने पेट को एक मिनट दीजिए।", "{X} की वजह से तनाव है?"],
  topics: ["कब्ज़", "पेट फूलने", "पेट", "पेट की गड़बड़ी", "आई-बी-एस", "अपच", "गैस"],
  intro: { comfortable: "चलिए, साथ में आराम से साँस लेते हैं।", long_exhale: "चलिए, साथ में लंबी, धीमी साँस छोड़ते हैं।", belly: "चलिए, साथ में पेट से साँस लेते हैं।",
    humming: "चलिए, साथ में गुनगुनाते हुए साँस छोड़ते हैं।", sigh: "चलिए, साथ में एक गहरी आह भरते हैं।", eyes: "चलिए, एक मिनट आँखों को आराम देते हैं।",
    breath_478: "चलिए, साथ में चार-सात-आठ ब्रीदिंग करते हैं।", box: "चलिए, साथ में बॉक्स ब्रीदिंग करते हैं।" },
  start: "चलिए, शुरू करते हैं।", encourage: "बहुत बढ़िया। ऐसे ही चलते रहिए।", halfway: "आधा हो गया।", last: "आख़िरी राउंड।",
  outroTitle: "कैसा लगा?", outroCta: "इसे सेव कर लीजिए, अगली भागदौड़ में काम आएगा।",
  done: { h3: "बहुत अच्छे", app: "अभी के लिए बस इतना" },
  words: ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस", "ग्यारह", "बारह"],
  rounds: n => `${hi.words[n]} राउंड`,
  about: (n, secs) => `${n} राउंड। करीब ${secs < 50 ? "आधा मिनट" : secs < 80 ? "एक मिनट" : secs < 110 ? "डेढ़ मिनट" : "दो मिनट"}।`,
  round: "राउंड {r} / {n}",
  ask: "अब कैसा महसूस हो रहा है?", chips: ["ज़्यादा शांत", "पहले जैसा", "ज़्यादा तनाव", "पता नहीं"],
  labels: {
    h3: { in: "साँस अंदर", hold: "रोकिए", out: "साँस छोड़िए", sip: "थोड़ा और", natural: "सामान्य साँस" },
    app: { in: "साँस अंदर लीजिए", hold: "आराम से रोकिए", out: "साँस छोड़िए", sip: "थोड़ा और", natural: "सहज साँस लीजिए" }
  },
  cues: { in: "नाक से।", hold: "ज़रूरत हो तो पहले ही साँस ले लीजिए।", out: "सहज होकर साँस छोड़िए।", sip: "एक छोटी-सी साँस और भरिए।", natural: "" },
  phrase: {
    "Breathe in": "साँस अंदर लीजिए", "Breathe out": "साँस छोड़िए", "Hold gently": "आराम से रोकिए", "Breathe out slowly": "धीरे-धीरे साँस छोड़िए",
    "Breathe into your belly": "पेट में साँस भरिए", "Hum as you breathe out": "गुनगुनाते हुए साँस छोड़िए", "A little more": "थोड़ा और",
    "Sigh it out": "आह भरकर छोड़िए", "Look far away": "दूर देखिए", "Let your eyes soften": "आँखों को ढीला छोड़िए",
    "Comfortable, unforced breaths.": "आराम से, बिना ज़ोर लगाए।", "An easy breath out.": "सहज होकर साँस छोड़िए।",
    "Through your nose.": "नाक से।", "Quietly, through your nose.": "धीरे से, नाक से।", "Let the out-breath be longer.": "साँस छोड़ना थोड़ा लंबा रखिए।",
    "Let your hand rise.": "हाथ को ऊपर उठने दीजिए।", "Let your belly soften.": "पेट को ढीला छोड़िए।",
    "A soft “mmm”, lips together.": "होंठ बंद, हल्का-सा “म्म्म”।", "Top up with a short sniff.": "एक छोटी-सी साँस और भरिए।",
    "Slowly, through your mouth.": "धीरे-धीरे, मुँह से।", "Slowly, through your mouth, with a soft whoosh.": "धीरे-धीरे, मुँह से, हल्की “फ़ूँ” के साथ।",
    "Breathe sooner if you need.": "ज़रूरत हो तो पहले ही साँस ले लीजिए।", "Something across the room or out of a window.": "कमरे के उस पार या खिड़की के बाहर कुछ।",
    "Blink slowly. Breathe out.": "धीरे से पलकें झपकाइए। साँस छोड़िए।"
  }
}

const cap = s => s[0].toUpperCase() + s.slice(1)
export const COPY = { es, hi }
// Fills a hook template ("{X}") with a topic, as fillHook does for English.
export const fillHookIn = (lang, h, x) => h.replace("{X}", x.trim() || COPY[lang].topics[2])
