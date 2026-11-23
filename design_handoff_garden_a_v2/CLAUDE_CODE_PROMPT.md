# Prompt for Claude Code

Paste everything below the line into Claude Code, from the root of the repository where Garden A already lives. Put this folder (`design_handoff_garden_a_v2/`) in the repository first.

---

Garden A, the 3D garden view of a group's ideas, is already implemented in this codebase from an earlier design handoff. The folder `design_handoff_garden_a_v2/` contains the next round of design work. Your job is to bring the existing implementation up to v2. Do not rebuild Garden A from scratch, and do not ship the HTML prototype itself.

**Read first**

1. `design_handoff_garden_a_v2/README.md`, all of it. It describes every addition, the exact colors, sizes and timings, the new scene API, and what changed from v1.
2. Find where Garden A lives in this codebase: the scene module that came from `garden3d.js`, and the screen or component that hosts it.

**Then diff**

The folder holds the v1 files exactly as you were first given them (`baseline/`) and the v2 files beside them. Run:

```
git diff --no-index --word-diff design_handoff_garden_a_v2/baseline/garden3d.js design_handoff_garden_a_v2/garden3d-v2.js
git diff --no-index --word-diff "design_handoff_garden_a_v2/baseline/SomeDaisy Garden A.html" "design_handoff_garden_a_v2/SomeDaisy Garden A v2.html"
```

Lines in these files are long, so use the word diff. That diff is the precise list of changes. Apply the same changes to the implementation that exists here, following this codebase's structure, naming and conventions. Where this codebase has already moved away from the prototype (framework, state management, data model, file layout), keep its way of doing things and port the behavior.

**What to build, in this order**

1. Scene changes with no new UI: seasons, lawn styles, house paint and textures, the sky dome, stars, shooting stars, clouds, the valley and extra hills. Check the garden still looks and behaves as before in Summer, Day, Soft lawn.
2. Extras (bench, birdbath, string lights) and the unlock rule driven by the count of finished ideas.
3. Water to nudge, and friends dropping by. Wire them to this app's real notification and realtime paths if they exist; if they do not, leave clear, typed hooks and say so.
4. The postcard: camera button, overlay, Share and Save.
5. The house: door, the walk-in transition, the gallery hallway, `buildWalls`, swipe and arrows, the caption bar, and the list with walk-to-wall. Use the app's existing "Things we did" data and, if there is one, its existing list screen.
6. The "Our garden" sheet, with its choices stored per group and sound stored per device.
7. Garden sounds.

**Rules**

- Fidelity is high. Match colors, type, spacing, proportions, timings and easing exactly. Where the README and `garden3d-v2.js` disagree, the file wins.
- The side panel in the prototype (Season, Time of day, Motion, Layout, Things done, Send a friend over, Start over) is a review tool. Do not build it into the product.
- The prototype's data is sample data: three members, nine ideas, and about 320 invented finished ideas for testing the hallway at scale. Use this app's real data model. Finished ideas need the day they were done.
- Keep every v1 tree, shrub and grass blade where it is. The README explains how v2 preserves the seeded layout; do not reorder the random draws.
- Do not carry over prototype-only code: the `?v=` cache-buster on the import, and `preserveDrawingBuffer` if the first handoff's note about removing it has been applied.
- Read "Changed from v1" and "Things to decide or change for production" in the README before you start. Anything in the second list that needs a product decision, ask me rather than guessing.

**When you are done, tell me**

- What you changed, file by file.
- Anything you could not match exactly, and why.
- Every hook you left unwired (realtime votes, nudge notifications, photos in frames, share), and what it needs.
- How you checked it: at minimum, the garden in each season and time of day, the house with 1, 3, 12, about 40 and 300 or more finished ideas, and the frame rate on a phone.
