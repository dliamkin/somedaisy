# Handoff: SomeDaisy "Garden A" v2 (additions to the garden you already built)

## Overview

Garden A (the 3D garden view of a group's ideas) is already implemented from the first handoff. This package contains **only what is new since then**. Nothing here replaces the flower logic, stages, voting, layouts or the realistic trees and grass; those are unchanged.

What v2 adds:

1. **Seasons** that follow the calendar
2. **Paint the house** (roof, walls, door) and **house textures**
3. **Choose the lawn** (Soft, Mown, Meadow)
4. **Extras you earn** (bench, birdbath, string lights)
5. **Friends drop by** (a live vote arrives as a butterfly)
6. **Send a postcard** (Share and Save)
7. **Water to nudge**
8. **Garden sounds**
9. **Walk into the house**: tap the door, go inside, and walk a gallery hallway where every finished idea hangs framed, however many there are
10. **A better sky and a wider world**: gradient skies, stars all round, a shooting star every 7 seconds at night, real-looking clouds, and a valley with hills on every side
11. **"Our garden" sheet**: new product UI that holds the group's paint, lawn, extras and sound choices

## About the design files

The files in this folder are **design references built in HTML**. They are a working prototype of the intended look and behavior, not production code to ship as-is. Recreate the additions in the codebase where Garden A already lives, using that codebase's patterns.

| File | What it is |
|---|---|
| `SomeDaisy Garden A v2.html` | The v2 prototype page: phone frame, app chrome, demo data, and a side panel of review controls that is **not product UI** |
| `garden3d-v2.js` | The v2 scene module. Source of truth for every 3D number, color and timing below |
| `baseline/garden3d.js` | The v1 scene module exactly as handed over the first time |
| `baseline/SomeDaisy Garden A.html` | The v1 prototype page exactly as handed over the first time |
| `CLAUDE_CODE_PROMPT.md` | A paste-ready prompt for this work |

**Start by diffing.** `diff baseline/garden3d.js garden3d-v2.js` and `diff "baseline/SomeDaisy Garden A.html" "SomeDaisy Garden A v2.html"` show every change precisely. Lines in these files are long, so use a word-level diff (`git diff --no-index --word-diff`). Apply the same changes to the implementation you already made, wherever that code now lives.

## Fidelity

**High fidelity.** Colors, type, spacing, proportions, timings and easing are final. Where this document and `garden3d-v2.js` disagree, the file wins.

## How to run the prototype

Serve this folder over HTTP and open `SomeDaisy Garden A v2.html`. It loads three.js `0.184.0` from unpkg and Nunito from Google Fonts. It opens in daytime with the season set from today's date.

---

## 1. Seasons

The garden shows the real season. The prototype maps months for the northern hemisphere: Dec to Feb Winter, Mar to May Spring, Jun to Aug Summer, Sep to Nov Autumn. Summer is the v1 look.

Three weights (spring, autumn, winter) are passed to the leaf, grass and ground shaders as one uniform and blend at rate 1.6 per second, so changing season is a smooth transition.

| Part | Spring | Autumn | Winter |
|---|---|---|---|
| Broadleaf trees | About 45% of leaves become blossom, pink to near-white | Leaves turn red through orange to gold, keeping their light and dark shading; a quarter stay partly green | Leaves and their dark inner clumps shrink away, leaving bare branches. Their shadows go too |
| Conifers and shrubs | Unchanged | Unchanged (evergreen) | Snow on up-facing needles and leaves |
| Grass | 10% brighter | Warmer and drier | Half height, frosted pale blue-white |
| Lawn texture | Unchanged | Warmer | Snow, with the path and shade still faintly visible |
| Far hills and their trees | Unchanged | Tan and olive | Pale and frosted |
| Roof | Unchanged | Unchanged | A snow layer rises onto the roof |
| Air | A pink petal drifts from the trees every 0.5s | A red, orange or gold leaf every 0.28s | 420 snowflakes falling at 0.5 to 1.1 units per second |

Flowers do not change with the season. Ideas stay in bloom all year.

Implementation notes:

- Leaves carry a per-leaf "evergreen" flag (third component of the `aS` attribute). Deciduous leaves respond to autumn, spring and winter; evergreen leaves only take snow.
- The winter shrink is applied in a **custom depth material** as well, otherwise bare trees still cast leafy shadows.
- Drifting leaves and petals reuse the existing soft particle burst.

## 2. Paint the house, and house textures

The group picks a roof, wall and door color. Colors blend at rate 2.2 per second when changed.

| Part | Choices (first is the default) |
|---|---|
| Roof | `#8A4BE6`, `#B8339A`, `#2F7BE8`, `#1FA98A`, `#E8B923` |
| Walls | `#FFFFFF`, `#FFD9C7`, `#CFE3FF`, `#F7C9EA` |
| Door | `#6D2FC4`, `#B8339A`, `#17806A`, `#E8B923` |

The house is no longer flat color. Every texture is a small canvas painted at load in white and soft grey-violet, so the paint color tints it:

| Surface | Texture |
|---|---|
| Walls | Clapboard: 12 boards up the wall, each lit at the top with a shadow line at the bottom edge |
| Gable ends | The same boards in the roof color |
| Roof slopes | Staggered shingles, four rows per tile, each shingle a slightly different shade |
| Door | An arched slab with vertical plank grain, two trim straps, and the knob |
| Chimney | Brick courses |

## 3. Choose the lawn

| Style | Blade height | Extra |
|---|---|---|
| Soft (default) | 1 | The v1 lawn |
| Mown | 0.42 | Light and dark mowing stripes about 1.2 units wide, running toward the house, on both the blades and the ground |
| Meadow | 1.75 | Up to 340 small wildflowers in white `#FFFFFF`, butter `#FFE08A`, pink `#F7C9EA` and lilac `#D9C2FF`, swaying with the grass. Hidden in winter |

Height, stripes and wildflowers blend at rate 3 per second. Blades still part around every idea flower.

## 4. Extras you earn

Finishing things together unlocks things for the yard. The thresholds are placeholders to confirm with the product owner.

| Extra | Unlocks at | Where | Notes |
|---|---|---|---|
| Bench | 3 done | Right of the path at `(2.45, -0.75)`, turned toward the path | White slats, `#B49FCF` legs and arms |
| Birdbath | 5 done | Left of the path at `(-2.5, -1.5)` | Stone `#F6F0FB`, water `#8EC5FF`, a small blue bird on the rim that dips to drink |
| String lights | 10 done | Three hanging spans: left tree to the left eave, across the front of the house, right eave to the right tree | Bulbs every 0.32 units in `#FFE08A`, `#F7C9EA`, `#CFE3FF`, `#FFD9C7`, each with a soft halo that brightens at night |

- Bench and birdbath pop in with a spring (stiffness 80, damping 11). Lights fade in at rate 4 per second.
- When a threshold is crossed: toast "{n} things done. {Name} unlocked", 1.9s after the "done" toast.
- An unlocked extra can be switched off and on in the Our garden sheet.

## 5. Friends drop by

When another member votes while you have the garden open, their butterfly flies in, lands on that idea's flower, their vote leaf unfurls, and a toast reads "{Name} is in on {idea}".

- The butterfly is in the member's color, 1.5 times the size of the ambient ones, with a dark name pill floating above it.
- It enters from the side nearest the flower, lands within about 2.5s (forced to land after 8s), rests for 2.8s, then leaves. It appears at any time of day.
- `onVisit(member, ideaId)` fires at the moment it lands. Apply the vote to the idea then, so the leaf and the landing line up.
- In the product this is driven by a realtime vote event. The prototype triggers it from a review button.

## 6. Send a postcard

A camera button in the header takes a picture of the garden as it looks now.

| Element | Spec |
|---|---|
| Flash | White overlay, opacity 0.9 to 0 over 0.5s |
| Backdrop | `rgba(44,32,64,.62)` over the whole screen, fades 0.3s |
| Card | 292 wide, white, padding 12px 12px 14px, radius 6, rotated -3 degrees, shadow `0 8px 12px rgba(0,0,0,.25)`. Springs in from 40px lower at 88% scale over 0.5s, `cubic-bezier(.3,1.3,.4,1)` |
| Picture | 4:5 crop of the full-screen render, positioned 60% down so the house and front flowers are both in |
| Caption | Group name, 900 18px. Below it "{Mon, Nov 23} · {n} ideas growing", 700 12.5px `#625475` |
| Buttons | "Share" (primary), "Save picture" (white outline, white text), "Close" (white text). 24px below the card, gap 8, padding 0 18 |

- **Share** opens the device share sheet with the postcard image attached (title: the group name; text: "Our garden today"). Toast "Sent". If cancelled, nothing happens. Where no share sheet exists, save the picture instead and say so.
- **Save picture** saves the same image. Toast "Saved. Ready for the group chat".
- The shared image is 1080 x 1500: white card, the picture at 984 x 1230 inset 48px, the group name at 900 56px and the date line at 700 34px beneath.
- The toast must sit **above** the postcard backdrop (`z-index: 2`).

## 7. Water to nudge

On the idea sheet, when the idea is below "Everyone's in" and someone other than you has not voted, a soft button reads "Water to nudge {names}".

- A violet watering can (`#8A4BE6`, off-white band and rose) appears beside the bloom, on the side nearer the middle of the screen.
- Timeline: scales in over 0.35s, tips between 0.3s and 0.7s, pours about 30 drops per second (`#8EC5FF`), the flower head bounces at 1.1s, the can rights itself by 2.15s and is gone at 2.5s.
- `onWatered(id)` fires at 1.1s. Send the nudge then. Toast "{names} got a nudge".
- Only members who have not voted are nudged, never someone who said "Eh". Add a sensible rate limit; the prototype has none.

## 8. Garden sounds

Off by default. One switch in the Our garden sheet. The prototype synthesizes everything so there are no audio files; treat it as a guide to what plays and when, and swap in recorded sound if preferred.

| Sound | When |
|---|---|
| Soft wind bed | Always, while sound is on |
| Birdsong | Day and Dusk: 2 to 4 chirps every 1.8 to 6s |
| Crickets | Night: short pulsed bursts every 0.9 to 2.4s |
| Single note | Tapping a flower, a frame, or a choice in Our garden; the bee arriving |
| Two rising notes | "I'm in" or "Eh"; a new idea planted; a friend landing; "Plan it" |
| Four-note rise | The flower opens because everyone is in; an extra unlocks |
| Five-note chime | A finished flower lands in the house |
| Falling four notes | Watering |
| Three notes | The door opening |
| One high note | The postcard shutter |

Notes are a triangle wave with a quiet octave above, half a second long, 90ms apart, in a major scale on G. Exact pitches are in the `NOTES` table in the HTML.

## 9. Walk into the house

Finished ideas now have a home you can visit: a gallery hallway inside the house. It is built to look right with three frames and to stay usable with three hundred or more.

**Getting in.** Tap the door, or the book button in the header. The door has a generous invisible tap area (about 1.05 x 1.7 units) because the door itself is small on screen. On hover the door opens a crack and warm light shows.

**The transition** (seconds):

| Phase | What happens |
|---|---|
| 0 to 1.3 | The door swings open. The camera flies down the path to just in front of it. Flowers shrink out of the way; the count pills and bottom bar leave; the header title changes to "Things we did" |
| 0.7 to 1.25 | A warm glow (`#FFF8E0` center to `#FFE08A`) grows from the doorway until it fills the screen |
| 1.3 | Under the glow, the camera is moved into the hallway, standing well back |
| 1.3 to 1.9 | The glow clears while the camera eases forward to the newest wall. The caption bar slides up |
| Leaving | Glow up over 0.35s, camera returns to the doorway at 0.4s, glow clears over 0.6s as the door closes and the camera rises back to the garden |

The hallway is a separate set placed far below the garden (`y = -60`), which is why it can be sized for a portrait screen rather than for the outside of the house. The glow hides the cut.

### Which frames hang where

This is the rule that answers "what do we show when there are only a few, and what do we show when there are hundreds".

1. **Every finished idea gets one frame.** Nothing is hidden, summarized or dropped.
2. **A wall holds up to 12 frames and covers whole calendar months.**
3. **Quiet months share a wall.** Months are packed onto a wall, oldest first, for as long as the total stays at 12 or fewer. A group that does one or two things a month still gets full-looking walls, labelled with the span ("Jul – Oct 2026").
4. **A busy month runs on.** A month with more than 12 continues on a second wall ("November 2026 · 1 of 2").
5. **Walls are packed from the oldest month forward**, so older walls never change. Only the newest wall changes as things get done.
6. **You always walk in at the newest wall.**

Wall labels: one month reads "November 2026"; several months in one year read "Jul – Oct 2026"; a span across New Year reads "Dec 2025 – Feb 2026".

The reference implementation is `buildWalls()` in the HTML. It is about fifteen lines and has no dependencies; port it as is.

| Finished ideas | What the group sees |
|---|---|
| 1 to 3 | One wall. The frames hang 22% larger, centered over the sideboard, so the wall does not look empty. No arrows |
| 4 to 6 | One wall, frames 12% larger |
| 7 to 12 | One wall at normal size |
| About 40 | Five or six walls |
| 300 and more | About forty walls. Swipe or use the arrows to walk back wall by wall; use the list to jump |

The prototype does not show zero finished ideas. For that case show one bare wall and the caption "Nothing here yet" with "Finish an idea and it hangs here" beneath.

### Getting around

- **Swipe sideways.** The wall follows the finger one to one. Releasing more than 56px from the start steps to the next wall; less springs back. Past either end it resists (a quarter of the finger's travel).
- **Arrows** in the caption bar step to the older wall (left) and the newer wall (right). They are disabled at the ends and hidden when there is only one wall.
- **The list.** The list button in the header, or a tap on the caption, opens every finished idea grouped by wall, newest first. Tapping a wall heading walks to that wall. Tapping an idea walks to its wall and leans in to its frame.
- **Far jumps.** Stepping to the next wall is a slide. Anything further is a quick dip of the same warm glow (0.16s up to 92%, 0.3s down) with the camera moved under it, so the walls in between never have to be built.
- **Only three walls ever exist**: the one in view and its two neighbours. Walls are built on arrival and disposed when left behind, so 300 frames cost the same to draw as 3. Walls beyond either end are built bare, so the hallway never shows an edge.

### The hallway

One bay per wall, 2.3 wide and 3.9 high, repeated along the hall. Older walls are to the left.

| Part | Spec |
|---|---|
| Wallpaper | `#EFE7F8` with faint pinstripes and a small daisy motif, repeating every 0.42 |
| Wall shading | A soft darkening toward the corners and the floor laid over the wallpaper, so the wall reads as lit from the middle |
| Woodwork | White wainscot 0.62 high with battens every 0.3 and a rail, a baseboard, and a crown moulding |
| Pilaster | White, 0.14 wide, between every two walls, carrying a brass sconce with a glowing globe at 2.84 and a ceiling beam above |
| Floor | Planks in four tones (`#E3BC9E`, `#DCB192`, `#E9C6AA`, `#D8AD8B`) running toward the viewer, with grain, joints and a contact shadow along the wall |
| Rug | Pink oval, `#F0B8DE` with a `#FBE3F3` center |
| Sideboard | 1.5 wide, 0.66 high, wood `#B98B63` with a `#D9B08A` top, tapered legs and brass knobs |
| On the sideboard | A brass table lamp with a cream shade `#FFF1CC`, three photo albums (`#8A4BE6`, `#F7C9EA`, `#FFD9C7`), and a white vase with three daisies. The arrangement is mirrored on alternate walls |
| Light | The scene's sun and sky light, a warm lamp `#FFE0A8` that is stronger at night, and soft warm pools on the wallpaper around the table lamp and the sconces (5% by day, 45% at night) |

Camera inside: position `(wallX, 2.0, 4.6)` looking at `(wallX, 1.62, 0)`, arriving from `z = 7`. From there the sideboard, floor and rug are in view below the frames.

### The frames

Up to 12 per wall, in fixed slots that fill from the middle outward so a wall looks composed at any count. Positions, sizes, shapes and colors are the `SLOT` table at the top of `garden3d-v2.js`.

- Nine rectangular frames (portrait, landscape and square) and three round or oval ones.
- Frame colors: gold `#E8B923`, violet `#8A4BE6`, white, ink `#2C2040`, peach `#FFD9C7`, teal `#1FA98A`, pink `#F7C9EA`. Bar widths 0.028 to 0.05.
- Frames whose shorter side is 0.36 or more have a cream mat (`#FFFDF8`, a tenth of the shorter side).
- Every frame has a diagonal streak of glass sheen and a soft shadow on the wallpaper, and hangs very slightly crooked. On entering, the frames sway briefly as if the door disturbed them.

**What is in a frame.** The prototype shows the idea's **pressed flower**: a daisy in the list color with a stem and leaf, on cream paper washed with 17% of the list color. Frames 0.4 wide or more also carry the idea's short name. **If the app has a photo for a finished idea, the photo should fill the frame instead and the pressed flower is the fallback.** Confirm with the product owner whether finished ideas have photos.

**Tapping a frame.** It lifts off the wall (scale 1.1), the camera leans toward it, and the caption bar shows its full title with "{list} · {date}" beneath. Tap it again or tap the wallpaper to step back. Hover: scale 1.04, pointer cursor.

When a flower is marked done in the garden, the toast reads "Pressed and framed in the house", the walls are hung again, and its frame is on the newest wall the next time you walk in.

## 10. Sky, clouds and the wider world

**Sky.** A large dome centered on the camera replaces the flat background color. Per time of day it blends four colors from the horizon haze up to the zenith, adds a glow around the rank daisy and along the horizon beneath it, and faint high wisps.

| | Horizon haze | Low | Mid | Zenith | Glow | Glow strength |
|---|---|---|---|---|---|---|
| Day | `#DDE6FF` | `#B9D7FF` | `#8CBCFF` | `#5A97EE` | `#FFF3D6` | 0.12 |
| Dusk | `#FFC79E` | `#FFB0A8` | `#C79BE8` | `#6E78D6` | `#FF9A5C` | 0.8 |
| Night | `#2C2452` | `#1F1840` | `#15102E` | `#0B0820` | `#B79CFF` | 0.15 |

The Day glow is deliberately weak and tight so the sky directly behind the rank daisy stays blue and its white petals stay readable. Keep that.

**Stars.** About 6,000 in three sizes (1.5, 2.2 and 3.3px) across the whole dome, twinkling slightly. They are attached to the dome, so they are there in every direction you can drag. They are a little denser along a broad, faint Milky Way band that crosses the view on a diagonal. Opacity follows the existing `night` value.

**Shooting star.** At night a shooting star crosses the part of the sky you are looking at **once every 7 seconds**, in a different place each time.

- It starts within 0.15 rad either side of the direction the camera faces and between 0.02 rad below and 0.1 rad above the horizon, then falls 0.06 to 0.1 rad while travelling 0.1 to 0.17 rad to the left or right, chosen at random.
- It lasts 0.9s, easing out. The streak trails about a third of the path behind the head, white at the head fading to lilac and to nothing at the tail, brightening and fading over its life.
- It is drawn on the dome, so hills and clouds pass in front of it.
- No shooting stars in the Still motion setting, or while the camera is inside the house.

**Clouds.** The three groups of ellipsoids are gone. There are now 20 cumulus clouds in a ring right round the sky. Each is a heap of 46 soft, lumpy puffs: larger along a flat base, smaller toward a domed top. Each puff is a camera-facing quad drawn with instancing, not a GL point; points disappear whole when their center leaves the screen and are size-capped on some phones.

| | Top | Base | Opacity |
|---|---|---|---|
| Day | `#FFFFFF` | `#C2D0EE` | 0.97 |
| Dusk | `#FFC2A8` | `#F08A8A` | 0.97 |
| Night | `#403A7A` | `#1D1838` | 0.6 |

- Clouds sway slowly in place (about 3 degrees either way over 3.5 minutes) instead of crossing the sky, and they rise gradually toward the rank daisy's bearing. Both rules exist so a cloud never sits behind the daisy and hides its petals.
- **Keep that rise gradual and the Milky Way diagonal.** An earlier build lifted clouds inside a hard-edged range of bearings and ran the star band straight up the middle of the view. At night the two together split the sky into a cloudy half and a starry half, like two pictures side by side.

**The valley.** The hilltop used to end in empty sky when you dragged sideways. It now sits in a landscape:

- A very large, gently rolling valley floor 4.6 units below the hilltop, mottled into lighter meadow and darker ground, colored with the far-hill color so it follows the time of day and the season.
- Nine more wooded hills at bearings right round the horizon, 38 to 46 units out.
- Several hundred trees scattered in clumps across the valley, larger near the hill and smaller with distance.
- These use their own random stream, and the star change spends the same number of seeded values as before, so **every v1 tree, shrub and grass blade is exactly where it was.**

## 11. New app chrome

Type, tokens, radii and shadows are the v1 ones. Only the additions are listed.

| Element | Spec |
|---|---|
| Header | A camera button (44 round, card background) sits between the title and the book button. The book button opens the house |
| Header, inside the house | Title "Things we did", subtitle "{n} so far". The back button leaves the house (or closes the list if it is open). The book button's icon becomes a list glyph and it opens the list. The done badge stays on it |
| Done badge | Now has `padding: 0 5px` (min-width 20 and height 20 as before), so a count of 100 or more stays inside the pill while one digit is still a circle |
| Bottom bar | A 44 round button with a 1.5px outline border and a sliders icon sits left of "Pick for us". It opens Our garden |
| Idea sheet actions | The row now wraps. Order: "I'm in", "Eh", "Plan it", "We did it!", "Close" (pushed right), then "Water to nudge {names}" (soft, padding 0 16) |
| In house mode | Count pills fade out (0.3s) and the bottom bar slides down (0.4s). Count pills also fade while Our garden is open |
| Toast | `z-index: 2`, so it shows over the postcard |

**Caption bar** (inside the house only). A floating bar, not a full-width sheet, so the floor and sideboard stay in view.

| Part | Spec |
|---|---|
| Bar | `left/right: 16px`, `bottom: 20px`, height 56, radius 28, card background, shadow `0 8px 12px rgba(90,40,140,.12)`. Slides up from below with the sheet easing, 0.38s |
| Arrows | 44 x 44 at each end, chevron icons in ink. Left is the older wall, right the newer. Disabled at 28% opacity at the ends; hidden when there is one wall |
| Middle | A button that opens the list. Line one 900 15.5px, line two 700 12.5px muted, both centered and truncated with an ellipsis |
| Text, no frame selected | The wall label, then "{n} things · wall {i} of {N}" (just "{n} things" when there is one wall; "1 thing" for one) |
| Text, frame selected | The idea's full title, then "{list} · {date}". Dates read "Nov 7" in the current year and "Nov 7, 2025" otherwise |

**The list sheet** (inside the house). Same sheet style as the idea sheet.

| Part | Spec |
|---|---|
| Header | "Things we did" 900 19px; beneath it "{n} so far. Tap one to walk to it." 700 13px muted; "Close" text button at the right |
| Body | Scrolls, max height 500. Walls newest first; within a wall, ideas newest first |
| Wall heading | Sticky, min height 44. The wall label 900 14px with the count beside it in 700 12.5px muted, centered vertically. Tapping it walks to that wall |
| Row | Min height 44. A 14px dot in the list color, the title 800 14.5px (one line, ellipsis), and "{list} · {date}" 700 12.5px muted. Tapping it walks to the wall and selects the frame |

In the product this list is the existing "Things we did" screen. Keep it as the complete, searchable, accessible record, and add the walk-to-wall behavior when it is opened from inside the house.

**Our garden sheet.** Same sheet style as the idea sheet. While it is open the camera pulls back and up to an overview (position `(0, 13.5, 16.5)`, looking at `(0, -4.6, -1)`) so the house, lawn and extras are all visible above the sheet.

| Row | Spec |
|---|---|
| Header | "Our garden" 900 19px; beneath it "Everyone in {group} sees these" 700 13px muted; "Done" text button at the right |
| Rows | Min height 44, 6px apart. Label 54 wide, 800 13px muted: Roof, Walls, Door, Lawn, Extras, Sounds |
| Swatch | 44 x 44 tap area holding a 30px dot with a 1.5px outline ring. Selected: a 2.5px gap in the card color, then an ink ring out to 5px |
| Choice pill | Height 44, padding 0 14, radius 22, 1.5px outline border, 800 14px. Selected: filled with the button color, white text |
| Lawn | Soft, Mown, Meadow |
| Extras | Bench, Birdbath, Lights. Unlocked: a pill that toggles. Locked: dashed border, muted text, with a second line "at {n} done" at 700 11.5px. Tapping a locked one shows the toast "Do {k} more thing(s) together to unlock the {name}" |
| Sounds | Off, On |

Tapping a flower or empty ground while the sheet is open closes it.

---

## State and data

New state the app needs:

| State | Scope | Notes |
|---|---|---|
| Roof, walls, door colors; lawn style | Per group, shared | Everyone in the group sees the same garden |
| Extras switched on or off | Per group, shared | Only meaningful once unlocked |
| The finished ideas, each with the day it was done | Per group | Drives the unlocks, the header badge and the walls |
| Sound on or off | Per device | Not shared |
| House requested, inside, current wall, selected frame, list open, Our garden open | View state | Not persisted |

Finished idea shape used by the prototype:

```js
{ t: 'Mini golf rematch', s: 'Mini golf', l: 'Day trips', d: '2026-11-23' }   // full title, short name, list, day done (ISO)
```

`buildWalls(list)` turns the flat list into walls: `[{ label: 'Jul – Oct 2026', items: [...up to 12, oldest first] }, ...]`, oldest wall first. The scene is given only the `items` arrays; labels, dates and the list live in the app.

The prototype's Things done review control includes 40 and 300+. Those use about 320 invented finished ideas (`GEN` in the HTML) spread unevenly from mid 2023, so the hallway can be reviewed at scale. They are sample data only.

### Scene API additions (`garden3d-v2.js`)

```js
const garden = createGarden(canvasHost, labelHost, {
  // v1: onSelect, onPressed, onPickArrive
  onDoor(),              // the door was tapped in the garden
  onInside(bool),        // the camera has arrived inside (true) or is back at the doorway (false)
  onWall(index),         // the user swiped to another wall, or a far jump has landed
  onFrame(slot | null),  // a frame on the current wall (its slot, 0 to 11), or the bare wallpaper, was tapped
  onWatered(id),         // the watering can has poured
  onVisit(member, id)    // a visiting friend's butterfly has landed
});

garden.setOptions({ /* v1 keys, plus: */ season, lawn, roof, walls, door, bench, bath, lights })
garden.setMemories(walls, at?)  // walls: oldest first, each an array of up to 12 finished ideas, oldest first. Stands at the newest wall unless `at` is given
garden.setWall(index)           // slide to the next wall; dip the glow and jump if it is further away
garden.selectFrame(slot|null)   // on the current wall
garden.setHouse(bool)           // go in or come out
garden.setDecor(bool)           // overview camera while Our garden is open
garden.water(id)                // returns false if it cannot start
garden.visit(member, id, name)  // returns false if a visit is already under way
garden.snapshot()               // JPEG data URL of the current view
```

`season` is `'Spring' | 'Summer' | 'Autumn' | 'Winter'`; `lawn` is `'Soft' | 'Mown' | 'Meadow'`; `bench`, `bath` and `lights` are booleans the app computes as "unlocked and switched on".

## Changed from v1 (things to update, not just add)

1. Clouds and stars were rebuilt; the old cloud groups and the 130 fixed stars are removed. The scene background color is still set but is now hidden behind the sky dome.
2. A tap that hits no flower is tested against the door before it counts as a tap on empty ground.
3. Flower name tooltips and the visiting-friend pill are hidden whenever the camera is not in the garden.
4. All flowers shrink while the house is open, as they already do for a selected flower.
5. The "done" toast copy changed to "Pressed and framed in the house".
6. The house door is now one arched, hinged piece that swings, with a warm doorway behind it.
7. The header's back button now does something inside the house (it leaves), and the book button changes role there (it opens the list).
8. Inside the house a sideways drag moves along the hallway. In the garden it still turns the view.
9. The prototype's Petal color, Petal shape and Vote leaves review options are gone from the page. The scene still accepts them and the page passes the defaults.

## Things to decide or change for production

1. **Photos in frames.** Confirm whether finished ideas have photos. If so, the photo fills the frame and the pressed flower is the fallback.
2. **Unlock thresholds** (3, 5, 10) are placeholders.
3. **The wall rule** (12 to a wall, whole months, quiet months share, packed from the oldest) is a recommendation that has been built and reviewed at 3, 5, 10, 40 and 300+ finished ideas. If the group can pin favorites later, a pinned wall can be added as the first wall without changing the rule.
4. **Season source.** The prototype uses the device date with northern-hemisphere months. Use the group's or device's hemisphere.
5. **Realtime.** "Friends drop by" needs a live vote event. Decide whether votes that arrived while the garden was closed are replayed on open.
6. **Nudges.** Wire "Water to nudge" to real notifications, with a rate limit.
7. **Sharing.** Use the platform share sheet. The prototype uses the Web Share API with a file, and falls back to saving.
8. **`preserveDrawingBuffer`** can still be removed: `snapshot()` renders and reads the canvas in the same task, which does not need it.
9. **Performance.** v2 adds roughly 130,000 triangles of distant trees, 920 cloud quads, three star layers and a full-screen sky shader. While the camera is inside the house the garden is still being drawn; hide it then. Frame pictures are small canvases made when a wall is built; if photos replace them, load and release them with the wall. Measure on a low-end phone and add quality tiers as already recommended in the first handoff.
10. **Accessibility.** The hallway needs the same non-canvas equivalent as the garden. The list sheet is that equivalent: make sure it is reachable by keyboard and screen reader without going through the canvas. Respect reduced motion by using the Still setting, which skips the fly-in, the sway and the shooting stars.
11. **Sound** is synthesized in the prototype. Replace with recorded audio if preferred, and follow the platform's rules for starting audio only after a user gesture.

## Assets

Still no image files. New canvas textures generated at load: clapboard, shingles, door planks, brick, daisy wallpaper, floor planks, sideboard wood, wall shading, glass sheen, the cloud puff, the shooting-star streak, the snowflake, and one picture per frame. New inline SVG icons: a camera, a sliders glyph, a list glyph and a right chevron.

External dependencies are unchanged: three.js `0.184.0` and Nunito.
