# Handoff: Garden A v3 (additions to v2)

## Overview

Garden A v2 is already implemented. This package is the next round. It adds six things:

1. **The house grows with the group's rank**: garage, second story, lanai, patio, mansion
2. **More paint**: 24 colors each for the roof, walls and door (was 5, 4 and 4)
3. **Four more lawn extras**: picnic blanket, woodpile, fire pit, pond
4. **Pictures in the frames**: each finished idea's own photo hangs in the house
5. **A card to share**: tapping a frame brings its picture up as a card with Share and Save
6. **A smoother night sky**

It also reorganises the "Our garden" sheet into tabs to hold all of this.

## About the design files

The files here are a **design reference built in HTML**: a working prototype of the intended look and behavior. They are not production code to ship. Apply the changes to the Garden A that already exists in the codebase, in its own structure and conventions.

## Fidelity

**High fidelity.** Colors, sizes, positions, timings and copy are final unless listed under "Things to decide". Where this document and `garden3d-v3.js` disagree, the file wins.

## What's in this folder

| File | What it is |
|---|---|
| `SomeDaisy Garden A v3.html` | The prototype page: phone frame, app chrome, sample data, review controls |
| `garden3d-v3.js` | The 3D scene |
| `baseline/garden3d-v2.js`, `baseline/SomeDaisy Garden A v2.html` | The v2 files exactly as handed off last time. Diff against these to see precisely what changed |
| `CLAUDE_CODE_PROMPT.md` | The prompt to paste into Claude Code |

The prototype's side panel (Rank level, Season, Time of day, Motion, Layout, Things done, Send a friend over, Start over) is a review tool. Do not build it.

Coordinates below are scene units. "House-local" means relative to the house group, whose origin is the middle of the house at ground level; +x is to the viewer's right, +z is toward the viewer.

---

## 1. The house grows with the group's rank

The scene takes a new option, `house`, from 1 to 6. The app sets it from the group's rank level. Each level keeps everything from the levels below.

| Level | Name shown | What it adds |
|---|---|---|
| 1 | Cottage | The v2 house, unchanged |
| 2 | Cottage with a garage | A garage on the right, with two pavers for a drive |
| 3 | Two-story home | A second story. The roof, gable window and chimney ride up on it |
| 4 | Home with a lanai | A covered porch across the front |
| 5 | Home with a patio | A stone terrace on the left with a table, two chairs and a striped umbrella |
| 6 | Mansion | A room over the garage, and a cupola with a pennant on the ridge |

**How a part arrives.** Each part is a spring from 0 to 1 (`v += ((target - s) * 60 - v * 10) * dt`), so it pops up with a slight overshoot. The second story and the room over the garage grow upward (scale on y only) and lift what sits on them; everything else scales from its base. When a level is reached, 18 warm particles (`#FFE08A`) burst from the new part. On load, in the Still motion setting, or while the camera is inside the house, parts appear at once with no animation.

**Paint.** New walls use the house's wall material, new roofs its roof material, and the upstairs shutters its door color, so the group's paint covers the whole house at every level. Clapboards on new walls are the same size as on the original walls.

### The parts

| Part | Spec (house-local) |
|---|---|
| **Garage** | Body 1.25 wide, 1.5 deep, eave at 1.3, centered at x 2.125, z 0.15 (set back from the house front). Gable roof facing the viewer: half-width 0.72, 0.6 high, 1.75 deep. Door panel 1.0 x 0.98 in `#F6F0FB` with three trim lines and a row of three small panes, framed in the trim color. Two stone pavers (1.0 x 0.44) lead forward from it |
| **Second story** | Wall 3.0 wide, 1.25 high, 2.2 deep, starting at 1.8. A white belt course 0.07 high where it meets the first floor. Two windows 0.56 x 0.66 at x ±0.72, each with a pair of shutters 0.14 x 0.7 in the door color. The top of the house lifts 1.25 |
| **Lanai** | Deck 3.3 wide, 0.72 deep, top at 0.42, wood `#D9B08A`. Three white posts 0.09 square at x −1.56, 0 and 1.56, so the door sits in the left bay and the window in the right. White beam at 1.67. Lean-to roof 3.5 x 0.95 in the roof material, tilted 0.33 rad. White railing with balusters across the right bay, a short stub left of the door, and both ends; the bay in front of the door is open |
| **Patio** | Round stone terrace, radius 0.7, at x −2.35, z −0.1. Round white table (radius 0.27) with two chairs. Umbrella: pole to 1.7, canopy radius 0.72 in eight pink (`#E0489E`) and white stripes, gold finial. The canopy is what reads from the garden; it shows over the shrubs |
| **Mansion** | Room over the garage: 1.25 x 1.15 x 1.5 with a belt course and a window 0.5 x 0.56; the garage roof lifts 1.15 onto it. Cupola on the ridge at z 0.35: white box 0.62 square and 0.56 high with panes on three sides, a four-sided roof in the roof color, a gold ball, a pole and a pink pennant that waves |

**Nothing is added above the eave to the right of the ridge.** The rank daisy sits in the sky there and must stay clear. An earlier build put a second chimney there and it crossed the daisy.

### What else changes as the house grows

| At level | Change |
|---|---|
| 2 and up | The fence right of the house is hidden, and the two shrubs right of the house (`BUSHES[2]` and `BUSHES[3]`) collapse to nothing, to make room for the garage. They come back if the level ever drops |
| 2 and up | The string lights are hung again: their right end goes to the garage's front corner instead of the tree |
| 3 and up | The points the smoke rises from and the done-flower flies to move up with the roof |
| 4 and up | The string lights hang along the front of the lanai instead of the eave. The two pots by the door lift 0.12 so they stand on the deck |
| Winter | The garage roof and the lanai roof get snow, like the main roof |

To make the lift possible, the roof, roof snow, gable window and chimney now sit in one group (`topG`). The fence and the pots are in groups too. Positions are unchanged at level 1.

## 2. More paint

24 colors for each part. The first in each row is the default.

- **Roof:** `#8A4BE6` `#6D2FC4` `#B8339A` `#E0489E` `#D9434E` `#B8402E` `#E2703A` `#C98A2B` `#E8B923` `#8FA83A` `#3E9A4E` `#1FA98A` `#17806A` `#2A9DB8` `#2F7BE8` `#3B5BC9` `#2C3E7A` `#5A6B8C` `#7A7F8E` `#4A4458` `#2C2040` `#8A6244` `#B98B63` `#C7B8D9`
- **Walls:** `#FFFFFF` `#FFF7E8` `#FBEFD5` `#FFE9B8` `#FFD9C7` `#FFC9B0` `#F7C9EA` `#F4B8C8` `#E6D2FF` `#CDB8F0` `#CFE3FF` `#A9CBF5` `#C9EEF0` `#BFE8D6` `#CFE5B8` `#A9C99A` `#E9E4DC` `#D8D2C8` `#C9C4D4` `#B8A48C` `#E8B8A0` `#C9705A` `#6E7FA8` `#4A4458`
- **Door:** `#6D2FC4` `#8A4BE6` `#B8339A` `#E0489E` `#D9434E` `#A8322C` `#E2703A` `#E8B923` `#F2D56B` `#8FA83A` `#3E9A4E` `#17806A` `#1FA98A` `#2A9DB8` `#2F7BE8` `#2C3E7A` `#2C2040` `#4A4458` `#7A7F8E` `#FFFFFF` `#FFF7E8` `#B98B63` `#8A6244` `#5B3E2B`

The scene needs no change for this; it already takes any color.

## 3. Four more lawn extras

They work exactly like the bench and birdbath: unlocked by the count of finished ideas, switched on or off by the group, and they spring up when turned on.

| Extra | Unlocks at | Position (x, z) | What it is |
|---|---|---|---|
| Picnic | 15 done | −2.45, 1.0 | Pink gingham blanket 1.0 x 0.8; wicker basket with a handle and a white cloth; two plates; two red apples and a green one; a teal bottle; a pink cup |
| Woodpile | 20 done | 2.55, 1.5 | Twelve logs stacked end-on in rows of 5, 4 and 3 between two stakes (bark `#8A6244`, cut ends `#E9C6AA`); a chopping stump with the axe left in it |
| Fire pit | 30 done | −2.1, 3.25 | Ring of nine stones (`#C9C4D4`), three logs, three flames (`#FF7A2E`, `#FFB23E`, `#FFE9A8`), two log seats |
| Pond | 40 done | 2.15, 3.3 | Water `#8EC5FF`, about 1.15 x 0.85, ringed with eleven stones; three lily pads, a pink flower, three reeds |

- **The fire** flickers in height and width and turns slowly. A warm light (`#FF9A4A`, reach 5) lights the lawn around it: intensity `1 + 7 x night`, so it is faint by day and strong after dark. In the Still setting it holds one shape.
- **The grass lies flat under each extra that is out.** The grass shader takes four new entries (`uX`: x, z, radius squared, weight) and shortens blades inside each radius as the extra springs in. Radius squared: picnic 0.5, woodpile 0.3, fire pit 0.25, pond 0.36. Meadow wildflowers are not planted in those spots.
- The spots are clear of every flower position in all three layouts, the path, the bench and the birdbath.

New options on the scene: `picnic`, `wood`, `fire`, `pond` (booleans, "unlocked and switched on").

## 4. Pictures in the frames

Each finished idea's frame now shows the idea's picture. **The app decides which picture, in this order:**

1. a photo someone in the group uploaded for the idea
2. otherwise the image pulled from the idea's link
3. otherwise the idea's stock photo

The app passes that one picture to the scene as `img` on each finished idea (a URL or data URL). The reference is `pic()` in the HTML.

- The picture is cropped to fill its frame (cover fit, centered). Frames with a picture have no caption.
- **The pressed flower hangs until the picture has loaded, and stays if it cannot load.** An idea with no picture at all keeps its pressed flower, as in v2.
- Pictures are loaded with `crossOrigin = 'anonymous'` because they are drawn into a canvas. **Images served from another origin must send CORS headers**, or the frame will keep the pressed flower and the card in section 5 cannot be saved.
- The scene keeps at most 90 loaded pictures; only the wall in view and its two neighbours hold textures, as before.

The prototype has none of the app's images, so its frames show random stand-in photos from picsum.photos. They are sample data; do not carry them over.

## 5. The card: share a finished idea

Tapping a frame still lifts it and leans the camera in. **320ms later its picture comes up as a card**, in the same overlay the garden postcard uses.

| Part | Spec |
|---|---|
| Overlay | Unchanged from the postcard: `rgba(44,32,64,.62)` backdrop, white card 292 wide tilted −3°, picture 4:5 |
| Picture | The same picture as the frame, cover fit, centered. If it cannot load, the pressed flower |
| Text on the card | The idea's full title (900 18px), then "{list} · {date}" (700 12.5px, `#625475`) |
| Buttons | "Share", "Save picture", "Close", as on the postcard |
| Beneath the buttons | The picture's source in white 700 13.5px ("Your photo", "Photo from the link", "Stock photo" or "Pressed flower"), then a text button: "Add our photo", or "Change photo" once the group has uploaded one |

- **Close** closes the card and lets the frame settle back on the wall.
- **From the list**, tapping an idea walks to its wall and opens its card 750ms later.
- **Share and Save** make one image, 1080 x 1500: a white card with the picture 984 x 1230 at (48, 48), the title beneath in 900 weight (56px, shrinking to fit the width, never below 30px), then "{group} · {list} · {date}" in 700 34px `#625475`. Share uses the device share sheet with the file attached and the text "{title}, with {group}"; where there is no share sheet it saves instead. File name: `somedaisy-{title as a slug}.jpg`.
- **Add our photo** opens the device's picture picker. The chosen picture is scaled to at most 1200px on its long side, becomes the idea's uploaded photo, and takes the frame over at once. Toast: "Your photo is in the frame".

The garden postcard itself is unchanged.

## 6. Night sky

Three causes of a patchy night sky are fixed. All three are Night only; Day and Dusk are unchanged.

| What | v2 | v3 |
|---|---|---|
| Cloud opacity | 0.6, so the overlapping puffs inside each cloud showed as patches | 0.95, so each cloud is one solid shape |
| Cloud colors | top `#403A7A`, base `#1D1838` | top `#3B3570`, base `#1F1A40` |
| High wisps | strength 0.25 | 0 (none at night) |
| Milky Way | a band broken up with noise | one smooth, slightly wider, fainter band (`vec3(.034, .03, .075)`, falloff 3.0) |

The sky also gets a very fine grain (1/150 of full scale, per pixel) at every time of day, so dark gradients do not show bands.

## 7. The Our garden sheet

Same sheet, same header ("Our garden", "Everyone in {group} sees these", "Done"). The six rows are replaced by three tabs so that everything fits.

| Part | Spec |
|---|---|
| Tabs | House, Lawn, Extras. Three equal buttons, height 44, radius 22, gap 6, margin 8px 0 10px, 800 14.5px. Unselected: page background (`--bg`), ink text. Selected: ink background, card-colored text |
| Pane | Min height 232, so the sheet does not change height between tabs |
| **House tab** | A line of 700 13px muted text with the name in 900 ink: "{name} · rank level {n} of 6. The next rank adds {what}." At level 6: "As grand as it gets." Then three pills (Roof, Walls, Door), then the 24 colors for the chosen part in a grid of 8 columns and 3 rows. Each cell is the v2 swatch: a 44 x 44 tap area holding a 30px dot |
| **Lawn tab** | "Lawn" row: Soft, Mown, Meadow. "Sounds" row: Off, On. Both as in v2 |
| **Extras tab** | The seven extras as pills in two equal columns: Bench, Birdbath, Lights, Picnic, Woodpile, Fire pit, Pond. Unlocked and locked states as in v2 ("at {n} done", dashed border) |

"The next rank adds" copy, by the level being reached: a garage; a second story; a lanai across the front; a patio with an umbrella; a room over the garage and a cupola with a pennant.

---

## State and data

| State | Scope | Notes |
|---|---|---|
| House level (1 to 6) | Per group | From the group's rank. Not chosen by the group |
| Picnic, woodpile, fire pit, pond switched on or off | Per group, shared | Only meaningful once unlocked |
| Each finished idea's uploaded photo, link image and stock photo | Per idea | The app already has these. The frame and the card use the first one that exists |
| Our garden: which tab, which part | View state | Not persisted |

### Scene API additions (`garden3d-v3.js`)

```js
garden.setOptions({ /* v2 keys, plus: */ house, picnic, wood, fire, pond })
garden.setMemories(walls, at?)   // unchanged, but each finished idea may now carry `img`
garden.flowerArt(idea, w?, h?)   // a canvas of the idea's pressed flower (600 x 750 by default), for the card when there is no picture
```

Nothing was removed from the v2 API.

## Changed from v2 (things to update, not just add)

1. Tapping a frame now opens the card. In v2 it only leaned in and showed the title in the caption bar; the caption bar still does that underneath.
2. A frame that has a picture has no caption text.
3. The postcard overlay is shared with the card: its title is now set per use, and it gains the row beneath the buttons (hidden for the postcard).
4. The Our garden sheet's rows became tabs.
5. Night clouds are solid and there are no night wisps.
6. The roof, roof snow, gable window and chimney moved into one group; the fence and the door pots moved into groups. Nothing moves at level 1.
7. The string lights are built by a function that is called again when the house grows, instead of once.
8. The two shrubs right of the house can now be hidden. Their leaves and cores are remembered by index range when the shrubs are built.

## Things to decide or change for production

1. **Rank levels.** The design has six house levels. Map the group's rank to 1 through 6 and hold at 6 for any rank above that. The prototype's header still reads "Thrill Seekers" at every level because the rank names were not available.
2. **Unlock thresholds** for the new extras (15, 20, 30, 40) are placeholders, like the earlier ones.
3. **"Add our photo" on the card is new.** It was added so that an upload can be seen taking the frame over. Confirm it should exist here as well as wherever the app already lets people upload a photo for an idea.
4. **The shrubs and fence right of the house go away at level 2.** Confirm that is acceptable, or the garage needs another home.
5. **CORS for idea images** (see section 4).
6. **Not tested in the prototype:** Share on a real phone; a real file chosen through the picture picker (upload was tested with a generated file); frame rate with the new parts.
7. **Performance.** The fire pit adds one point light. The house parts add a few hundred small meshes; merge them per level if draw calls matter. Frame pictures are 256px-wide textures.

## Assets

No image files. New canvas textures generated at load: the gingham blanket and the umbrella stripes. No new icons. External dependencies are unchanged: three.js `0.184.0` and Nunito.
