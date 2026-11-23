# Handoff: SomeDaisy "Garden A" (3D garden view)

## Overview

SomeDaisy is a shared "someday" list app for groups. Garden A is an alternative way to look at a group's ideas: instead of a list, the group sees a little house on a hilltop, and every idea is a 3D daisy growing in the yard. A flower's bloom stage shows how far the idea has moved along, its leaves show who has voted, a date marker shows it is planned, and finished ideas fly into the house ("Things we did").

The garden sits **alongside** the existing list view. It does not replace it.

## About the design files

The files in this folder are **design references built in HTML**. They are a working prototype that shows the intended look and behavior. They are not production code to ship as-is.

- `SomeDaisy Garden A.html` is the prototype page: a 390 x 844 phone frame with the app chrome, plus a side panel of demo options that is **not part of the product**.
- `garden3d.js` is the three.js scene and all its interaction logic. It is the source of truth for every 3D measurement, color and animation constant in this document.

Your task is to recreate this in the target codebase using its established patterns:

- If the app is web-based, `garden3d.js` can be ported closely. It is a single ES module with one export and no dependencies besides three.js. Restructure it into the codebase's module and component conventions rather than pasting it in.
- If the app is React, wrap the scene in a component that owns the canvas and calls the scene API from effects. (react-three-fiber is optional. The scene is imperative and animation-heavy, so a thin wrapper around the imperative module is the lower-risk route.)
- If the app is native (React Native, Swift, Kotlin), pick the appropriate 3D route for that stack (for example expo-gl with three, SceneKit, or a WebView hosting the web scene) and rebuild the app chrome (header, pills, sheet, bar) natively.
- If no codebase exists yet, choose the most appropriate framework and implement there.

## Fidelity

**High fidelity.** Colors, typography, spacing, 3D proportions, timings and easing are final. Recreate them exactly. The numbers in `garden3d.js` win over any rounding in this document.

## How to run the prototype

Serve the folder over HTTP (ES modules do not load from `file://`) and open `SomeDaisy Garden A.html`. It loads three.js `0.184.0` from unpkg through an import map and Nunito from Google Fonts.

---

## Screen: Garden A

One screen, 390 x 844 (phone, portrait). The 3D canvas fills the whole screen. App chrome floats over it.

### Layer order (bottom to top)

1. `#gl`: the WebGL canvas, `position:absolute; inset:0`
2. `#labels`: HTML tooltips and pills positioned over flowers, `pointer-events:none`
3. Header, count pills, toast
4. Bottom bar
5. Idea sheet (slides over the bottom bar)

### App chrome

Font is **Nunito** everywhere (weights 500, 700, 800, 900).

| Element | Spec |
|---|---|
| Phone frame | 390 x 844, radius 40, border 1px `#E7DBF3`, shadow `0 8px 12px rgba(90,40,140,.12)` |
| Header | `left/right/top: 16px`, flex row, gap 10 |
| Round button (back, book) | 44 x 44, radius 22, background card, icon stroke ink, stroke width 2 to 2.4 |
| Title | "Weekend crew", 900 20px/1.1 |
| Subtitle | "Thrill Seekers · 30 to go", 800 12.5px |
| Done badge (on book) | min-width 20, height 20, radius 10, `#B8339A`, white 900 11.5px, offset -4px top right. Scales 1 to 1.3 to 1 over .6s ease-out when a flower lands |
| Count pills | `top: 74px`, `left/right: 16px`, gap 6. Each: height 32, padding 0 10, radius 16, card background, 800 12.5px, count in 900. Labels: "New", "Waiting", "Everyone's in", "Planned" |
| Toast | `top: 120px`, centered, padding 9px 16px, radius 20, background `#2C2040`, white 800 13.5px, max-width 330. Fades .4s, auto-hides after 3s |
| Bottom bar | padding 12px 16px 20px, background bg, border-top 1px line, two equal buttons, gap 10 |
| Button (pill) | height 44, padding 0 22, radius 22, 800 15px. Active: `scale(.96)` |
| Primary | background btn, white text |
| Outline | transparent, 2px border btn, text link |
| Soft | transparent, 1.5px border outline, text ink |
| Text | transparent, text link, padding 0 14 |
| Sheet | radius 30 30 0 0, padding 20px 16px 22px, card background, shadow `0 -8px 12px rgba(90,40,140,.12)`. Closed: `translateY(110%)`. Transition `transform .38s cubic-bezier(.3,1.1,.4,1)` |
| Sheet title | idea title, 900 19px |
| Sheet subtitle | 700 13px, muted, margin 2px 0 12px |
| Member row | flex, gap 14, wraps. Each: 16px circle + name (800 13px) + status (700, muted). Voted: circle filled with the member color, 1.5px solid ink border. Not voted: transparent, 1.5px dashed outline border |
| Sheet actions | flex, gap 8. "I'm in" (primary), "Eh" (soft), "Plan it" (primary), "We did it!" (primary), "Close" (text, pushed right) |

Bottom bar buttons: "Pick for us" (outline), "Add an idea" (primary).

### Chrome color tokens

| Token | Day and Dusk | Night |
|---|---|---|
| card | `#FFFFFF` | `#2A2038` |
| ink | `#2C2040` | `#F4EEFB` |
| muted | `#625475` | `#C4B5D4` |
| bg | `#F6F0FB` | `#171124` |
| line | `#E7DBF3` | `#3F3150` |
| btn | `#6D2FC4` | `#8A4BE6` |
| link | `#5A25A6` | `#C9A6FF` |
| outline | `#B49FCF` | `#8A76A6` |
| pink | `#9C2580` | `#F0A6DD` |

Chrome backgrounds transition over .8s when the time of day changes.

---

## The 3D scene

Units are scene units (roughly meters). Y is up. The camera looks toward negative Z.

### World

- **Hill**: a sphere of radius 16 centered at `(0, -16, -1)`. Ground height: `gy(x, z) = sqrt(256 - x² - (z + 1)²) - 16`. Everything is placed with this function.
- **Path**: `pathX(z) = 0.4·sin(0.8z) - 0.5·clamp((-z - 1) / 3, 0, 1)`. Twelve stepping stones from z = 3.5 down to -3.8 in steps of 0.62, alternating ±0.09 off the path. Each stone: cylinder radius 0.3, height 0.06, z-scale 0.8, `#F6F0FB`.
- **Fog**: linear, near 19, far 80, in the theme's haze color. Sun, clouds and stars are excluded from fog.

### Camera

- Perspective, FOV 52° (vertical), near 0.1, far 400.
- Resting position `(0, 6.6, 13.5)`, looking at `(0, 1.3, -1.2)`.
- **Intro**: starts at `(0, 11, 21)` looking at `(0, 7, -12)`, eases to rest over 3s (ease-out cubic).
- **Selected flower**: looks at `(fx, ground + 0.55, fz)` from `(fx - sign(fx)·2.6, 6.0, fz + 6.2)`.
- All camera moves use exponential smoothing at rate 2.6 per second.
- **Drag** horizontally to orbit around the look target: `yaw = -dx·0.006`, clamped to ±0.7 rad, springs back to 0 on release. A press that moves under 7px is a tap.
- **Pointer parallax**: ±0.04 rad yaw and ±0.3 units of height. **Idle sway**: x ±0.2 at 0.25 rad/s, y ±0.08 at 0.31 rad/s.

### Lighting

- Hemisphere light (sky and ground colors from the theme).
- Directional sun at `(6, 12, 8)`, casts shadows: 2048 map, orthographic ±9, near 1, far 40, bias -0.0005, normalBias 0.04, radius 2.
- Window point light `#FFE08A` in front of the house, distance 11, decay 1.4. Intensity comes from the theme and flashes when a finished flower lands.
- No tone mapping. Materials are Lambert so brand colors stay true.

### Time of day

Every value blends with exponential smoothing at rate 2.2 per second.

| Key | Day | Dusk | Night |
|---|---|---|---|
| sky | `#CFE3FF` | `#FFD9C7` | `#171124` |
| fol (multiplies all foliage, lawn, bark, soil) | `#FFFFFF` | `#F3CDBB` | `#8A80DC` |
| haze (fog) | `#D9DEFF` | `#FBD3D0` | `#1B1530` |
| hemisphere sky | `#FFFFFF` | `#FFFFFF` | `#C4B5D4` |
| hemisphere ground | `#E6D2FF` | `#F7C9EA` | `#3D2F5A` |
| hemisphere intensity | 1.7 | 1.6 | 1.5 |
| sun color | `#FFFFFF` | `#FFFFFF` | `#C9A6FF` |
| sun intensity | 1.9 | 1.7 | 0.9 |
| window pane | `#CFE3FF` | `#FFE08A` | `#FFE08A` |
| sky daisy petals | `#FFFFFF` | `#FFE08A` | `#F4EEFB` |
| sky daisy y | -2.7 | -10.5 | -0.8 |
| stars opacity | 0 | 0.3 | 1 |
| flower stems | `#17523A` | `#17523A` | `#8FE0BD` |
| window light | 0 | 3 | 9 |

### Sky

- **Rank daisy (the sun)**: at `(7.15, sunY, -60)`, scale 0.85. Eight petals at 45° steps, 3.4 from the center. Earned petals are solid ellipsoids (1.25 x 2.45 x 0.2); unearned petals are outline rings of the same shape. The prototype shows 5 of 8. Center is `#FFD25A`. It turns at -0.05 rad/s and fades out while a flower is selected.
- **Clouds**: three groups of four white ellipsoids, drifting right at 0.37, 0.26 and 0.46 units/s and wrapping at x = ±34. They shrink and hide at night.
- **Stars**: 130 points, 2.2px, opacity from the theme.

### House (at z = -5.2)

| Part | Spec |
|---|---|
| Body | 3 x 1.8 x 2.2, `#FFFFFF` |
| Roof | triangular prism, base 3.6, height 1.35, depth 2.6, `#8A4BE6` |
| Door | 0.62 x 1.0 with a round top, `#6D2FC4`; knob `#E8B923`; step `#F6F0FB` |
| Window | 0.74 x 0.62 pane in the theme pane color, trim `#B49FCF`, window box `#FFD9C7` with small plants |
| Attic window | round, radius 0.3, white ring. Finished flowers fly here |
| Chimney | `#F7C9EA` with a white cap; six smoke puffs rise and fade in a loop |
| Extras | two pots (`#FFD9C7`) by the door, white picket fence either side at z = -4.75 |

### Flowers (one per idea)

Each flower is a two-segment stem, a calyx, 8 petals, a yellow center (`#FFD25A`), three vote leaves, and an optional date marker.

**Stage drives the shape:**

| Stage | Meaning | Petal fold (rad) | Center scale | Head tilt (rad) | Head scale | Stem height |
|---|---|---|---|---|---|---|
| 1 | New | 1.38 (closed bud) | 0.25 | 0.12 | 0.8 | 0.78 |
| 2 | Waiting on votes | 0.8 (half-open cup) | 0.8 | 0.5 | 0.93 | 1.05 |
| 3 | Everyone's in | 0.16 (full bloom) | 1 | 0.95 | 1 | 1.36 |
| 4 | Planned | 0.16 | 1 | 0.95 | 1 | 1.36 |

Stem height also adds `(id % 3) · 0.07` for variety.

**Petal color** follows the idea's list: Movies `#7B3FE4`, Places `#2F7BE8`, Food `#E0489E`, Day trips `#1FA98A`.

**Vote leaves**: one leaf per member, in that member's color (Sam `#CFE3FF`, Alex `#FFD9C7`, Jo `#F7C9EA`). Scale 1 = "I'm in", 0.6 = "Eh", 0.24 and stem-colored = has not voted.

**Planned marker**: a white plaque (0.52 x 0.38) on a `#B49FCF` stake behind the bloom, with a `#B8339A` border and the day of the month in ink, Nunito 900.

**Soil**: a soft brown disc (radius 0.36) sits under each flower, and the lawn parts around it (see Grass).

**Positions**: twelve fixed slots either side of the path (`SLOTS` in the file), plus three front-row slots for newly added ideas (`EXTRA`) so a new bud always plants in view.

**Motion** (spring = stiffness, damping):

| Change | Animation |
|---|---|
| Appear | grows from the ground, smoothing rate 2.2/s; intro staggers flowers by 0.17s starting at 1.3s |
| Stage change | petals spring open (70, 10); head scale springs (90, 9) with a bounce; reaching stage 3 or 4 fires a burst of 16 petal particles |
| Date marker | springs in (90, 10) |
| Move between slots | smoothing rate 3.2/s |
| Wind | stem segments and head sway with the shared wind function |
| Hover | head scales to 1.1 and a name tooltip appears |
| Selected | a `#B8339A` ring (radius 0.55) circles the head; all other flowers shrink to 35% |
| Done | flies to the attic window in 1.25s (smoothstep), arcing 2.4 high, shrinking to 14%, spinning 9 rad/s; then an 18-particle burst, a window flash, and the done badge pops |

### Labels

Names are hidden by default.

- **Tooltip** on hover (or when the bee picks): 800 11px Nunito, padding 1px 7px, radius 9, card background, ink text, with a 9px rotated-square pointer. It sits 7px above the topmost drawn point of that flower (petal tips or date marker) and is clamped 6px inside the screen edges.
- **Hit testing** uses the flower's actual drawn meshes first, then small invisible proxies as a fallback. Keep this. Earlier versions with box-shaped hit areas felt wrong.

### Creatures

| Creature | Behavior |
|---|---|
| Butterflies | 4 built (`#F7C9EA`, `#FFE08A`, `#CFE3FF`, `#FFD9C7`). 2 fly in Gentle, 4 in Lively, none in Still or at night. They wander, then approach and perch on flowers at stage 2 or higher for 2.5 to 6s |
| Bee | "Pick for us" sends it in from the front left. It circles the chosen flower for 3.6s (the ring pulses, the tooltip shows, the toast reads "How about ...?"), then leaves |
| Fireflies | 10, at night only, pulsing `#FFE08A` |

### Trees, shrubs and grass (the realistic layer)

All of this is procedural and seeded, so it is identical on every load. No image files are used.

**Lawn texture.** A 768px canvas texture is projected straight down over ±14 units. It is painted from value noise in greens (`rgb(56,110,48)` to `rgb(98,150,62)`, with dry patches toward `rgb(140,146,78)`), then overlaid with a worn tan path under the stepping stones and darker shade under the house, trees and shrubs.

**Grass.** About 18,000 instanced tufts of three blades each (roughly 50,000 blades).

- Blade: 0.2 to 0.3 tall, 0.042 wide at the base, tapering to a point, with a slight lean. Vertex color runs from 0.42 at the root to 1.08 at the tip, so roots read as shaded.
- Tuft color follows the same noise as the lawn texture: `rgb(92,164,62)` to `rgb(156,212,98)`, drying toward `rgb(204,210,112)`.
- No grass under the house, pots, stones or shrubs. Shorter and thinner along the path. Taller and drier outside the garden (beyond |x| 3.4, z 5 or z -6.5). Extra tall tufts hug fence posts, trunks, shrubs and the house walls.
- **Wind and clearing run in the vertex shader.** Blades bend by the wind function with a height-squared falloff and brighten slightly as a gust passes. Up to 16 flower positions are passed as a uniform; blades within 0.1 of a flower collapse fully and return to full height by 0.35, so the lawn parts around every flower and follows it when it moves.
- Blades are lit with an up-facing normal so the lawn shades like the ground. They receive shadows but do not cast them.

**Trees.** Eight broadleaf trees and eight conifers.

- Broadleaf: a recursive branching skeleton (trunk with root flare, three scaffold limbs, two or three forks per level, depth 3 for the four near trees and 2 for the back ones) built as tapered tubes with a painted bark texture. Each branch tip and mid-limb carries a leaf clump.
- Leaf clump: a dark inner blob plus 130 to 240 instanced leaves near its shell. Leaves are lighter on the outside and top, darker inside, with about 7% yellowed.
- Conifer: a straight trunk, a dark inner cone, and drooping tiers of needle sprays, darker near the trunk.
- The two trees that frame the house: left `(-3.05, -5.65)` at full size (about 4.3 tall), right `(3.0, -5.3)` at 0.8 scale. **The right one must stay short enough that it never covers the rank daisy.**
- A tree just out of frame at `(5.7, 0.9)` exists to cast dappled shade on the right edge of the lawn.
- All leaves (about 43,000) are one instanced mesh. Each leaf is a 4-triangle folded diamond. Leaves are lit by a per-leaf normal that points outward from the crown, which is what makes the canopy read as a soft volume instead of noise. Leaves cast and receive shadows.
- Wind sways leaves by height above the ground and flutters each one, in the vertex shader.

**Shrubs.** Eight, built from the same leaf clumps with smaller leaves (0.11 to 0.14). Positions and sizes are in `BUSHES`.

**Far hills.** Three large spheres (`#86B870`, multiplied by the foliage tint) covered in about 1,300 small instanced cone and ball trees. Fog fades them to roughly 60% haze, which keeps the distance soft and pastel.

**Foliage palettes** (dark, light, yellowed, inner core):

| Use | Colors |
|---|---|
| Left tree, back trees | `#2C6A33`, `#8DCB57`, `#C5D96A`, `#2E6230` |
| Right tree | `#3E7F3A`, `#A6D968`, `#D2DF7A`, `#3A7236` |
| Side tree | `#2A6644`, `#7CC474`, `#B9D780`, `#2B6040` |
| Conifers | `#1F4F3A`, `#5E9C62`, (none), `#173A2B` |
| Shrubs A | `#2F6E3A`, `#86C35C`, `#B8D66C`, `#2E6434` |
| Shrubs B | `#3A7A4E`, `#93CF86`, `#C2DC8C`, `#356C46` |

**Wind function** (shared by flowers on the CPU and grass and leaves on the GPU, so everything moves together):

```
wind(x, z, t) = amp · ( sin(1.15t + 0.7x + 0.45z)·0.6
                      + sin(2.4t + 1.4x - 0.3z)·0.25
                      + max(0, sin(0.23t + 0.2x))^6 · 0.8 )
```

`amp` is 0 for Still, 1 for Gentle, 2 for Lively.

---

## Interactions and behavior

| Action | Result |
|---|---|
| Tap a flower | Selects it: camera moves in, ring appears, others shrink, sheet opens |
| Tap empty ground, or "Close" | Deselects |
| "I'm in" / "Eh" | Records the current user's vote. If every member is "in", the idea moves to stage 3; otherwise stage 2. Shown only while the idea is below stage 3 and the user has not said "I'm in" |
| "Plan it" | Shown at stage 3. Sets a date and moves to stage 4 |
| "We did it!" | Shown at stage 4. Closes the sheet, the flower flies into the house, the done count goes up, toast: "Pressed into Things we did" |
| "Add an idea" | Adds a stage 1 bud in a front slot. Toast: "{title} is planted" |
| "Pick for us" | The bee picks at random from stage 3 ideas (or from all, if none are stage 3) |
| Hover | Pointer cursor, head grows, tooltip appears |
| Drag | Look around |

**Sheet subtitle copy:**

- Stage 1: "Added by {name}" plus " today" if it is 0 days old
- Stage 2: "Waiting on {names}", or "Not everyone is in yet"
- Stage 3: "Everyone's in"
- Stage 4: the date, for example "Sat, Nov 28"
- Below stage 4 and older than 0 days, append " · Someday for {n} days"

**Member status copy:** "hasn't voted", "I'm in", "Eh". The current user is shown as "{name} (you)".

---

## State and data

### Idea shape used by the prototype

```js
{
  id: 6,
  t: 'Mini golf rematch',   // full title (sheet, aria-label)
  s: 'Mini golf',           // short label (tooltip)
  l: 'Day trips',           // list name, picks the petal color
  st: 4,                    // 1 New, 2 Waiting, 3 Everyone's in, 4 Planned
  d: 61,                    // days since added
  v: [1, 1, 1],             // one entry per member: 0 not voted, 1 in, 2 eh
  by: 'Sam',                // who added it
  date: 'Sat, Nov 28',      // stage 4 only
  day: '28',                // stage 4 only, shown on the marker
  fly: true                 // set when marked done, until the flight ends
}
```

Map this onto the app's real idea model. The stage is derived: no votes = 1, some votes = 2, all in = 3, has a date = 4.

### Scene API (`garden3d.js`)

```js
const garden = createGarden(canvasHost, labelHost, {
  onSelect(id | null),   // a flower or empty ground was tapped
  onPressed(id),         // a finished flower landed in the house; remove it from the list now
  onPickArrive(id)       // the bee reached its pick
});

garden.setIdeas(ideas, intro?)  // diff by id; pass intro=true for the staggered first reveal
garden.setOptions({ layout, time, motion, petals, petalShape, voteLeaves })
garden.select(id | null)
garden.pick(id)
garden.restart()
garden.dispose()
```

The scene is driven entirely by `setIdeas`. Call it with the full list after every change and it animates the difference.

### Options

The side panel in the prototype is a **design review tool, not product UI**. Decide per option whether it ships:

| Option | Values | Suggested product behavior |
|---|---|---|
| layout | Meadow, Path, Tall stems | Ship Meadow as the default. Path groups flowers by stage along the path. Tall stems sorts by age, sets stem height to `0.7 + sqrt(days)·0.15`, hides date markers and shows day-count pills beside each head |
| time | Day, Dusk, Night | Follow the device clock or the app's light/dark theme |
| motion | Still, Gentle, Lively | Gentle by default; Still when the system asks for reduced motion |
| petals | List color, Accent (`#B8339A`, night `#E678CE`), White | List color |
| petalShape | Daisy, Round, Slim | Daisy |
| voteLeaves | on, off | On |

---

## Things to change for production

1. **Remove `preserveDrawingBuffer: true`** from the renderer. It is only there so the design tool can capture the canvas, and it costs performance.
2. **Remove the `?v=3`** on the module import. It is a cache-buster for the design tool.
3. **Member count is hard-coded to three** (three leaves, three colors, "Jo" is index 2). Generalize to the group's real members and decide how more than three or four leaves should look.
4. **Capacity**: 12 slots plus 3 front slots, and the grass clearing uniform holds 16 flowers. Larger groups of ideas need more slots, paging, or a filter.
5. **Rank**: the sky daisy shows 5 of 8 petals as a fixed value. Wire it to the group's real rank.
6. **Performance has not been measured.** The scene draws roughly 500,000 triangles per frame including the shadow pass. Add quality tiers (fewer leaves per clump, fewer tufts, 1024 shadow map, pixel ratio 1.5) for low-end devices, pause the render loop when the view is hidden, and call `dispose()` on unmount.
7. **Accessibility**: the canvas has no keyboard or screen-reader path. The list view is the accessible equivalent; make switching between the two views easy, and consider a visually hidden list of ideas mirrored from the garden.
8. **Known open issue**: in some layouts a planned flower's date marker can sit visually over a neighboring bloom. The tap area is correct; only the overlap needs a nudge.
9. **Contrast note**: the lawn is a mid green, so teal "Day trips" petals (`#1FA98A`) have less contrast against it than the other three list colors.

---

## Design tokens

### Brand and scene colors

| Name | Hex |
|---|---|
| Ink | `#2C2040` |
| Violet (primary button, door) | `#6D2FC4` |
| Violet light (roof, night button) | `#8A4BE6` |
| Accent pink (ring, badge, marker border) | `#B8339A` |
| Daisy center | `#FFD25A` |
| Sky blue / member Sam | `#CFE3FF` |
| Peach / member Alex | `#FFD9C7` |
| Pink / member Jo | `#F7C9EA` |
| Lavender | `#E6D2FF` |
| Warm light | `#FFE08A` |
| Trim | `#B49FCF` |
| Stone | `#F6F0FB` |
| Stem (day) / stem (night) | `#17523A` / `#8FE0BD` |
| List: Movies, Places, Food, Day trips | `#7B3FE4`, `#2F7BE8`, `#E0489E`, `#1FA98A` |

### Type

Nunito. Sizes used: 20/900 (title), 19/900 (sheet title), 15/800 (buttons), 13.5/800 (toast), 13/800 and 13/700 (sheet rows), 12.5/800 (pills, subtitle), 11.5/900 (badge), 11/800 (tooltips).

### Radii

40 (phone), 30 (sheet top), 22 (buttons, round buttons), 20 (toast), 16 (count pills), 10 (badge), 9 (tooltips).

### Shadows

`0 8px 12px rgba(90,40,140,.12)` (cards), `0 -8px 12px rgba(90,40,140,.12)` (sheet).

### Spacing

Screen edge 16. Header to pills 14. Button height 44 (minimum tap target). Gaps 6, 8, 10, 14.

---

## Assets

There are no image assets. Everything is geometry, flat color, or a small canvas texture generated at load (lawn, bark, soil, date numbers). The two header icons are inline SVG strokes (a back chevron and an open book).

External dependencies: three.js `0.184.0` and the Nunito font.

## Files

| File | What it is |
|---|---|
| `SomeDaisy Garden A.html` | Prototype page: phone frame, app chrome, demo data, demo options panel, and the glue between UI and scene |
| `garden3d.js` | The whole 3D scene: world, house, flowers, creatures, trees, shrubs, grass, camera, hit testing, labels |
| `README.md` | This document |
