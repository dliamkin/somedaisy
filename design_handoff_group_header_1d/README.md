# Handoff: Group screen header, option 1d (full-width rank bar, buttons moved)

## Overview

The group screen is already implemented. This package is a small change to the top of it: the strip between the photo and "Coming up".

It answers two pieces of feedback: the rank bar should run the full width, and the three round icon buttons (tulip, calendar, trophy) were small and it was not clear what they did.

What changes:

1. **The rank bar runs the full width** and names both the current rank and the next one.
2. **The rank strip is the way into Ranks.** The trophy button is removed.
3. **Calendar moves to the "Coming up" row** as a named pill, in place of "See all". The calendar button is removed.
4. **Garden becomes a named white pill** on the seam between the photo and the sheet, under the daisy. The tulip button is removed.

"Coming up" starts 2px higher than it does today. Nothing else on the screen changes.

## About the design files

The files here are a **design reference built in HTML**: a mock of the intended look. They are not production code to ship. Apply the change to the group screen that already exists in the codebase, in its own structure and conventions.

## Fidelity

**High fidelity** for layout, sizes, spacing and copy.

Two caveats, because the mock was built from a screenshot of the live screen rather than from the code:

- **Colors were sampled from a JPEG screenshot** of the dark theme, so they can be a step or two off. Where the app already has a token for the same role, use the token.
- **The font (Lexend) and text sizes were matched by eye.** Where the live screen already has a text style for an element that stays (rank name, "to go", the petals line, "Coming up"), keep the live style. The sizes below are binding only for the new elements.

## What's in this folder

| File | What it is |
|---|---|
| `SomeDaisy Group Header 1d.dc.html` | Before and after, side by side. Open it in a browser; it needs `support.js` beside it and a connection for the font and icons |
| `support.js` | Runtime for the file above. Not part of the design |
| `assets/group-top/hero.jpg`, `card.png` | Crops of the live screen used as context in the mock. Not assets to ship |
| `baseline/group-screen-today.jpg` | Screenshot of the group screen as it ships today |
| `screenshots/before-today.png`, `screenshots/after-1d.png` | The two screens from the mock as images, 1080 px wide |
| `CLAUDE_CODE_PROMPT.md` | The prompt to paste into Claude Code |

In the mock, the labels above each screen, the notes below, and the Tweaks (Progress, Petals line) are review tools. Do not build them.

---

## Before and after

| | Today | 1d |
|---|---|---|
| Rank bar | 172 wide, left of the buttons | 328 wide (full content width) |
| Rank text | "Weekenders" + "55 to go" | "Weekenders → Thrill Seekers" on the left, "55 to go ›" on the right |
| Ranks | Round trophy button | Tap anywhere on the rank strip |
| Calendar | Round calendar button | Named pill at the right of the "Coming up" row |
| Garden | Round tulip button | Named white pill on the photo/sheet seam |
| "See all" | Link at the right of "Coming up" | Removed. The Calendar pill replaces it |
| The daisy on the photo | Not tappable, or unchanged | Spins when tapped. It does not open the Garden |
| "Coming up" starts | 114 below the top of the sheet | 112 below the top of the sheet |

## Layout

All sizes are CSS px on a 360-wide screen (the screenshot is 1080 px at 3x). The sheet is the dark rounded panel that overlaps the photo: background `#171124`, top corners rounded 30, content inset 16 left and right, so the content column is 328 wide.

Inside the sheet, top to bottom:

| Item | Height | Gap above |
|---|---|---|
| Photo credit row (unchanged) | 16 | 10 (sheet's top padding) |
| Rank strip | 53 | 9 |
| "Coming up" row | 20 | 24 |
| Event card (unchanged) | | 16 |

The Garden pill is positioned against the sheet's top edge and takes no space in this stack.

## Components

### 1. Rank strip

One block, full content width, and one tap target. It replaces the old left column and the three round buttons.

| Part | Spec |
|---|---|
| Container | Column. `min-height: 44`, content centered vertically, so it stays a 44 target if the petals line is ever dropped |
| Petals line | "Grow your group's petals!" Lexend 600, 12/16, `#CBA8F6`. 4 below it. Copy and style as today |
| Rank row | Row, centered vertically, gap 6, no wrapping, 20 high |
| Current rank | Lexend 700, 15/20, `#F4EDFB`. Sample: "Weekenders" |
| Arrow | `arrow-right`, 12, `#C4B4D3` |
| Next rank | Lexend 500, 14/20, `#C4B4D3`. Sample: "Thrill Seekers" |
| "N to go" | Pushed to the right edge. Lexend 400, 13/20, `#C4B4D3`. Copy as today: "55 to go" |
| Caret | `caret-right`, 12, `#CBA8F6`. The cue that the strip opens something |
| Bar | 5 below the rank row. 8 high, radius 4, track `#402E5D`, full width |
| Fill | `#F771D2`, radius 4, width = progress toward the next rank, `min-width: 8` so it is a dot at zero |
| Goal ring | 14 x 14 circle at the right end of the bar: 2px dashed border `#CBA8F6`, filled with the sheet color `#171124`. Offset right −2, top −3, so it is centered on the bar and overhangs the end by 2. It echoes the dashed petals of the daisy: the next rank, not yet grown |

### 2. Calendar pill

Sits at the right end of the "Coming up" row, where "See all" is today. The rest of the row is unchanged: "Coming up" then the count pill (23 x 18, radius 9, `#402E5D`), gap 9.

| Part | Spec |
|---|---|
| Tap target | 44 high, centered on the row. It overflows the row above and below; the row stays 20 high in the layout |
| Visible pill | 32 high, radius 16, padding 0 12 0 10, background `#2C2039`, shadow `0 6px 12px rgba(5,2,12,.35)` |
| Content | `calendar-dots` icon, 17, `#CBA8F6`; gap 6; "Calendar" in Lexend 600, 13, `#F4EDFB` |

The visible pill clears the bar above by 18 and the card below by 10.

### 3. Garden pill

| Part | Spec |
|---|---|
| Position | Right edge on the content inset (16 from the screen edge). Top is 18 above the sheet's top edge, so 18 of it sits on the photo and 26 on the sheet. Drawn above both |
| Size | 44 high, hugs its content (about 120 wide), radius 22, padding 0 13 0 12 |
| Surface | `#FFFFFF`, shadow `0 6px 12px rgba(5,2,12,.4)`. Same white as the round buttons at the top of the photo |
| Content | `flower-tulip` icon, 19, `#9547EF`; gap 6; "Garden" in Lexend 600, 14, `#2C2040`; gap 6; `caret-right`, 12, `#2C2040` |

On this screen the pill's top edge lands 3 below the daisy.

### Removed

- The three round 44 buttons (tulip, calendar, trophy).
- The "See all" link. The Calendar pill opens the calendar and replaces it.

## Interactions and behavior

| Tap | Goes to |
|---|---|
| Rank strip (anywhere on it) | Whatever the trophy button opens today |
| Calendar pill | Whatever the calendar button opens today |
| Garden pill | Whatever the tulip button opens today |
| The daisy on the photo | Nowhere. It spins (see below) |

- **Pressed states** are not drawn. Use the app's existing pressed treatment for pills and for tappable rows.
- **Bar fill** should animate the way the current bar does. No new motion is specified.
- **Screen readers:** the rank strip is one button, for example "Ranks. Weekenders. 55 to go until Thrill Seekers". The goal ring and the arrows are decorative.

### The daisy

Tapping the daisy on the photo does not navigate. It spins: one full turn about its center, 700ms, `cubic-bezier(.2,.8,.2,1)`. A tap during a spin adds another turn; it does not restart. With reduced motion on, skip the spin. The daisy has filled and dashed petals, so the turn is easy to see. These are starting values; tune them by feel.

A hidden easter egg on the daisy is wanted but not designed. Count taps in the handler so one can be added later without restructuring. Build nothing for it now.

## States and edge cases

- **Top rank.** The plan is for the strip to ask whether the group wants to "prestige" and go round again. That is deferred and not drawn; do not build it yet. Until it is, keep whatever the screen does at the top rank today, with the bar at full width, and hide the arrow, the next name and the goal ring, since there is no next rank.
- **Long rank names.** The rank row never wraps. If it runs out of room, the next rank's name shrinks and ends in an ellipsis. The current rank, "N to go" and the caret keep their size.
- **Long photo credit.** The Garden pill covers the right end of the credit row. At 360 the sample credit stops 13 short of the pill, so a longer photographer name will reach it. Cap the credit's width at the content width minus the pill's width minus 12, and end it in an ellipsis.
- **No photo credit** (a group without an Unsplash photo). Nothing else moves; the Garden pill stays on the seam.
- **Progress 0.** The fill is an 8 dot. **Progress 100.** The fill meets the ring.
- **Narrower screens.** Everything is fluid: the bar and the rank row take the content width; the two pills hug their content.

## State and data

No new state beyond the daisy's tap count. The strip needs **the name of the next rank**, which comes from the rank ladder already in the app. "Thrill Seekers" in the mock is a stand-in.

## Design tokens

Dark theme values, sampled from the live screen. Map each to the app's token for that role; the light theme then follows from the tokens and is not drawn here.

| Role | Value |
|---|---|
| Sheet background | `#171124` |
| Raised surface (pills, cards, the old round buttons) | `#2C2039` |
| Bar track, count pill | `#402E5D` |
| Bar fill | `#F771D2` |
| Accent (petals line, links, icons) | `#CBA8F6` |
| Secondary text | `#C4B4D3` |
| Primary text | `#F4EDFB` |
| Brand purple (Garden icon) | `#9547EF` |
| Text on white | `#2C2040` |

Radii: 4 (bar), 16 (Calendar pill), 22 (Garden pill), 30 (sheet top). Shadows: `0 6px 12px rgba(5,2,12,.35)` on dark pills, `0 6px 12px rgba(5,2,12,.4)` on the white pill.

## Assets

- **Icons:** `flower-tulip`, `calendar-dots`, `arrow-right`, `caret-right`, Phosphor bold in the mock. They were chosen to match the icons already on this screen. Use the app's own icon set.
- **Font:** Lexend in the mock, matched by eye. Use the app's font.
- No new images.

## Decided

1. **"See all" goes.** The Calendar pill replaces it and opens the calendar.
2. **The daisy does not open the Garden.** Tapping it makes it spin. A hidden easter egg may follow later.
3. **Top rank.** The strip will offer to "prestige" and start another round. Deferred and not drawn.
4. **The next rank's name** comes from the rank ladder already in the app.

## Still open

1. **Ranking up.** What happens at the moment the bar fills is not drawn.
2. **The petals line.** Kept. Dropping it would save a further 20 and the strip is built to allow it.
3. **Finding Ranks.** With the trophy gone, the caret is the only sign that the strip opens Ranks. If people miss it, the fallback is a trophy icon just before the caret.
4. **The daisy's easter egg.** Not designed.
