Below is a **Cursor-ready implementation brief** for building a prototype of the Gutsphere Today screen with the **My Gut Today gut-heart anchor**, **relief-first adaptive card**, **quick actions**, and **dynamic care feed**.

You can paste this directly into Cursor.

---

# Cursor Prompt: Build Gutsphere Today Prototype

Build an interactive mobile-first prototype for the **Gutsphere Today screen**.

The goal is to prototype the feeling and flow, not production backend logic.

Use realistic mock data and client-side state. The design system / skills document with colors, typography, spacing, radius, components, and UI configuration will be provided separately. Use that document as the source of truth for visual styling. Do not invent a conflicting design system.

---

# Product Principle

The Today screen is a **relief-first dynamic care surface**.

Users do not open the app because they want information. They open because they want:

1. Relief
2. Reassurance
3. Control
4. A clear next step
5. Help staying consistent with tracking and care
6. Help preparing for care conversations

The UI should help users move from:

```text
“I feel bad and I don’t know what to do.”
```

to:

```text
“I know the next small step.”
```

Avoid making the screen feel like:

* A dashboard
* A chart page
* A medical portal
* A social feed
* A generic content feed

The page should have a **fixed structure** with **dynamic content inside it**.

---

# Target User Context

Design primarily for users with moderate to high symptom severity, especially adults aged 35+.

They may open the app while:

* Bloated
* In pain
* Experiencing urgency
* Fatigued
* Anxious
* In the bathroom
* About to eat
* Managing medication
* Preparing for a doctor visit

This means the UI must be:

* Calm
* Large
* Easy to scan
* Low friction
* Supportive
* Non-judgmental
* Action-oriented

---

# Fixed Today Page Structure

Implement this exact structure:

```text
1. Relief Header
2. My Gut Today Card
3. Quick Action Strip
4. For You Today Card Rail
5. Today’s Simple Plan
6. Dynamic Support Feed
```

Do not make the entire structure dynamic. Only the content inside each section changes.

---

# Section 1: Relief Header

## Purpose

Set emotional tone immediately.

## Default copy

```text
Good Morning, Sarah 👋
Let’s make today easier.
```

## Dynamic variants

Morning:

```text
Good Morning, Sarah 👋
Let’s make today easier.
```

Afternoon:

```text
Good Afternoon, Sarah ☀️
Let’s keep things steady.
```

Evening:

```text
Good Evening, Sarah 🌙
Let’s close the loop gently.
```

Severe day:

```text
You’re having a harder day.
Let’s keep this simple.
```

## UI requirements

* Compact header
* Dynamic greeting based on time-state toggle
* Optional small metadata line:

  * “2 care tasks today”
  * “Last check-in: yesterday evening”
  * “Medication due later”

---

# Section 2: My Gut Today Card

This is the most important card.

It contains the **gut-heart identity object** and acts as the user’s daily gut status/check-in/update anchor.

Think:

```text
“My Gut Today”
```

Not:

```text
Gut score
```

Not:

```text
Instagram story
```

The gut-heart should be a visual identity/status object inside a larger card, not a tiny story circle.

---

## Card layout

```text
[ Gut-heart icon ]

My Gut Today

How are you feeling right now?

[Okay] [Not Great] [Struggling]

We’ll keep today simple.
```

## Gut-heart visual states

Use a heart-shaped gut icon or placeholder symbol if custom icon is unavailable.

States:

### Not checked in

* Soft outline
* Gentle neutral color
* Optional subtle pulse
* Label: “Check in”

### Checked in / okay

* Soft filled tone
* Label: “Checked in”
* Copy: “You’re feeling okay.”

### Not great

* Warm amber or calming accent
* Label: “Needs care”
* Copy: “You’re feeling not great.”

### Struggling / severe day

* Calm deep tone, not aggressive red
* Label: “Hard day”
* Copy: “You’re having a hard moment.”

### Medication due

* Gut-heart with small medication badge
* Copy: “Medication due now.”

Important: avoid red unless truly critical.

---

## Initial state: Not checked in

```text
My Gut Today

How are you feeling right now?

[Okay] [Not Great] [Struggling]

We’ll keep today simple.
```

Interaction:

* User taps one of the feeling options.
* Card transforms immediately.
* Show small success/celebration microcopy.

---

## After selecting “Okay”

Card transforms to:

```text
My Gut Today

Checked in: Okay

Nice job checking in.

One care task left today.
```

Primary action:

```text
View today’s plan
```

Secondary action:

```text
Update feeling
```

---

## After selecting “Not Great”

Card transforms to:

```text
My Gut Today

Checked in: Not Great

Nice job checking in.
Let’s keep today simple.

Start with one small step:
Keep your next meal simple today.
```

Actions:

```text
Done
Show another option
Log symptom
```

---

## After selecting “Struggling”

Trigger severe day mode.

Card transforms to:

```text
My Gut Today

You’re having a hard moment.

Let’s focus on relief first.

1. Log what’s happening
2. Follow today’s care plan
3. Save a note if needed
```

Actions:

```text
Log symptom
Log bowel
View care plan
Save doctor note
```

Also update page content below to Severe Day Mode.

---

## If medication due state is selected from prototype controls

Card should show:

```text
My Gut Today

Medication due now

Evening probiotic

Complete this care task first.
```

Actions:

```text
Complete
Snooze
Skip
```

After Complete:

```text
Done.

One care task left today.
```

---

## My Gut Today interactions

Implement:

* Feeling selection
* Update feeling
* Show another relief option
* Done action
* Trigger severe day mode
* Medication complete/snooze/skip
* Bottom sheet for “Log symptom”
* Bottom sheet for “Log bowel”
* Bottom sheet for “Save doctor note”

---

# Section 3: Quick Action Strip

## Purpose

Many users open Gutsphere to log quickly. Do not make them hunt.

Place this immediately below My Gut Today.

## Layout

Horizontal pill/action strip or compact card row:

```text
Symptom
Bowel
Medication
Note
```

Use icons if available, but always include text labels.

## Order

Use this order:

1. Symptom
2. Bowel
3. Medication
4. Note

Optionally include Meal and Water later, but the top strip should prioritize high-severity use cases.

## Interaction

Each action opens a bottom sheet.

---

## Symptom bottom sheet content

```text
Log Symptom

What are you feeling?

[Bloating]
[Pain]
[Urgency]
[Nausea]
[Reflux]
[Constipation]
[Diarrhea]

Severity
[1] [2] [3] [4] [5]

Optional note
```

CTA:

```text
Save Symptom
```

After save, show toast or card update:

```text
Saved.
This helps today’s guidance become clearer.
```

---

## Bowel bottom sheet content

```text
Log Bowel Movement

Bristol Type
[1] [2] [3] [4] [5] [6] [7]

Urgency?
[No] [Mild] [High]

Pain?
[No] [Mild] [High]

Optional note
```

CTA:

```text
Save Bowel Log
```

---

## Medication bottom sheet content

```text
Medication

Evening probiotic
Due at 7 PM

[Complete]
[Snooze]
[Skip]
```

---

## Note bottom sheet content

```text
Add Note

What should we remember?

[Text area]

Optional tags:
Meal
Stress
Sleep
Doctor
Flare
```

CTA:

```text
Save Note
```

---

# Section 4: For You Today Card Rail

## Purpose

Engaging large cards that surface dynamic, useful content.

Use larger horizontally scrollable rounded rectangular cards. Do not use small Instagram-style circles.

Cards should be useful without a tap.

## Layout requirements

* Horizontal rail
* 1.1 to 1.25 cards visible at a time
* Large rounded cards
* Cards are interactive
* Tap opens detail sheet
* Some cards include direct actions

---

## Default card set

### Card 1: Relief Step

```text
Relief Step

Keep lunch simple today.

Your symptoms are elevated,
so choose foods you usually tolerate.

[Done]
[Another option]
```

### Card 2: Care Task

```text
Care Task

Evening medication due at 7 PM.

Only one care task left today.

[Complete]
[Snooze]
```

### Card 3: Reassurance

```text
Reassurance

Hard days don’t erase progress.

You had 5 stable days this month.
```

### Card 4: Pattern Reflection

```text
Pattern Reflection

Poor sleep has aligned with worse
symptoms 4 times this month.

[View details]
```

### Card 5: Understand Today

```text
Understand Today

Why poor sleep can make
symptoms feel worse.

2 min read
```

---

## Severe Day card set

When “Struggling” is selected, replace the For You Today cards with:

### Card 1: Immediate Support

```text
Immediate Support

Start with one small step.

Log what’s happening,
then follow today’s care plan.

[Log symptom]
```

### Card 2: Care Task

```text
Care Task

Evening medication due at 7 PM.

Stay with your care routine
if it matches your plan.

[Complete]
```

### Card 3: Doctor Note

```text
Save for Doctor

Capture this episode while it’s fresh.

This can help you explain
what happened later.

[Add note]
```

### Card 4: Reassurance

```text
Reassurance

You don’t need to solve everything now.

Just capture what’s happening
and take the next small step.
```

Do not show general education first in severe mode.

---

## Detail sheet behavior

When a card is tapped, show bottom sheet:

```text
[Card title]
[Expanded explanation]
Why you’re seeing this
[Relevant action]
```

Example:

```text
Pattern Reflection

Poor sleep has aligned with worse symptoms 4 times this month.

Why you’re seeing this:
Your sleep logs were below baseline before several higher symptom days.

[View insight]
```

---

# Section 5: Today’s Simple Plan

## Purpose

Adherence support without shame.

Use this section instead of generic “Tasks”.

## Default content

```text
Today’s Simple Plan

1. Take medication at 7 PM
2. Log symptoms before bed
3. Keep hydration steady
```

Each item should include:

* Label
* Due time if available
* Status
* Complete action
* Snooze action where relevant
* Skip / not today action where relevant

## Visual state

Use checklist-like cards, but not childish.

Example:

```text
[ ] Take medication
    Due 7 PM
    Complete · Snooze

[ ] Log symptoms
    Before bed
    Complete

[ ] Keep hydration steady
    In progress
    Add water
```

After completion:

```text
[x] Take medication
    Completed 7:08 PM
```

## Severe Day version

```text
Today’s Simple Plan

Let’s keep it simple.

1. Log what’s happening
2. Take scheduled medication
3. Save a note if symptoms change
```

---

# Section 6: Dynamic Support Feed

## Purpose

Lower-priority dynamic support.

This should not become endless.

Show 3 cards max in prototype.

Possible card types:

1. Doctor prep
2. Tracking cue
3. Pattern reflection
4. Contextual education
5. Progress/reassurance
6. Refill/lab reminder

---

## Default support cards

### Doctor Prep Card

```text
GI Visit Prep

You had 4 high-symptom days this week.

Create a summary for your doctor?

[Prepare Summary]
```

### Tracking Cue Card

```text
Tracking Cue

A quick bowel log will make
today’s guidance clearer.

[Log Bowel]
```

### Contextual Education Card

```text
Understand Today

Why stress can affect digestion.

2 min read

[Read]
```

---

## Severe mode support cards

### Doctor Note Card

```text
Doctor Note

Save this episode for later.

[Add Note]
```

### Care Routine Card

```text
Care Routine

Medication routine needs attention.

Restart with today’s scheduled dose?

[View Medication]
```

### Minimal Education Card

```text
Understand Today

Why symptoms can feel more intense
on high-stress days.

2 min read
```

Only show this after immediate support and care tasks.

---

# Prototype Controls

Add a floating or side panel for prototype controls so we can test states.

Controls:

```text
User State:
- Not checked in
- Checked in: Okay
- Checked in: Not Great
- Severe Day
- Medication Due
- Evening Reflection
- Low Data State

Time of Day:
- Morning
- Afternoon
- Evening

Actions:
- Reset
- Add sample symptom
- Add bowel log
- Complete medication
```

The UI should update dynamically based on these controls.

---

# Empty / Low Data State

If user has low data, show supportive copy.

Do not show fake insights.

```text
Welcome to Today

We’ll keep things simple.

Start with one quick check-in
or log what’s happening now.

[Check in]
[Log symptom]
```

Today Snapshot / Feed should show:

```text
Guidance gets clearer as you log symptoms, bowel movements, meals, and care tasks.
```

Do not show pattern cards if there is not enough mock data.

---

# Content Logic

Implement simple mock logic.

## State variables

Use client-side state such as:

```ts
type FeelingState = 'not_checked_in' | 'okay' | 'not_great' | 'struggling';

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

type CareState = {
  medicationDue: boolean;
  medicationCompleted: boolean;
  symptomLoggedToday: boolean;
  bowelLoggedToday: boolean;
  doctorVisitUpcoming: boolean;
  lowData: boolean;
};
```

## Top card priority logic

The Adaptive Relief Card should prioritize:

```text
1. Severe day / struggling
2. Medication due now
3. Not checked in
4. Not great checked-in relief step
5. Evening reflection
6. Okay checked-in next plan
```

Pseudo logic:

```ts
if feeling === 'struggling':
  show severe day card
else if medicationDue && !medicationCompleted:
  show medication due card
else if feeling === 'not_checked_in':
  show check-in card
else if feeling === 'not_great':
  show relief step card
else if timeOfDay === 'evening':
  show evening reflection card
else:
  show checked-in summary card
```

---

# Interaction Requirements

Implement these interactions:

## My Gut Today

* Select Okay
* Select Not Great
* Select Struggling
* Update feeling
* Show another relief option
* Mark relief step done

## Quick Actions

* Open symptom bottom sheet
* Open bowel bottom sheet
* Open medication bottom sheet
* Open note bottom sheet
* Save action updates state

## For You Cards

* Horizontal scroll
* Tap opens detail sheet
* Action buttons update mock state

## Today’s Simple Plan

* Complete task
* Snooze task
* Skip task
* Completed state styling

## Dynamic Feed

* Tap card opens detail
* CTA opens related bottom sheet or mock state

---

# Tone and Copy Rules

Use relief-first language.

Prefer:

```text
Let’s keep today simple.
Start with one small step.
Nice job checking in.
Hard days don’t erase progress.
Restart today.
This helps today’s guidance become clearer.
```

Avoid:

```text
You failed.
Compliance score.
Risk prediction.
Flare likely.
You are doing poorly.
You forgot to log.
```

---

# Visual Direction

Use the provided design system/config document.

General direction:

* Large rounded cards
* Warm neutral backgrounds
* Calm accent colors
* Soft elevation
* Large touch targets
* Clear hierarchy
* Adult, premium, supportive feel
* Minimal dense text
* Avoid harsh red
* Avoid excessive animation
* Avoid tiny icons without labels

The gut-heart should feel like a premium identity object, not a childish mascot.

---

# Expected Prototype Output

Build a working interactive prototype where we can test:

1. The gut-heart “My Gut Today” anchor
2. Feeling check-in flow
3. Severe day transformation
4. Medication due flow
5. Quick action logging
6. Large For You Today cards
7. Today’s Simple Plan adherence actions
8. Dynamic support feed
9. Low-data state
10. Morning / afternoon / evening variants

The output should let us evaluate whether this Today screen feels:

* Useful
* Calm
* Relief-first
* Easy to act on
* Not overwhelming
* Habit-forming
* Appropriate for high-symptom 35+ users
