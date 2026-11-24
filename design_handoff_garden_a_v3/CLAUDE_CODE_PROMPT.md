# Prompt for Claude Code

Put this folder (`design_handoff_garden_a_v3/`) in the root of the repository where Garden A lives, then paste everything below the line into Claude Code.

---

Garden A, the 3D garden view of a group's ideas, is implemented in this codebase up to v2 (seasons, the house you walk into, extras, postcards and so on). The folder `design_handoff_garden_a_v3/` contains the next round of design work. Your job is to bring the existing implementation up to v3. Do not rebuild Garden A, and do not ship the HTML prototype itself.

**Read first**

1. `design_handoff_garden_a_v3/README.md`, all of it. It describes every addition, the exact colors, sizes and timings, the scene API additions, and what changed from v2.
2. Find where Garden A lives in this codebase: the scene module that came from `garden3d-v2.js`, and the screen or component that hosts it.

**Then diff**

The folder holds the v2 files exactly as you were given them last time (`baseline/`) and the v3 files beside them. Run:

```
git diff --no-index --word-diff design_handoff_garden_a_v3/baseline/garden3d-v2.js design_handoff_garden_a_v3/garden3d-v3.js
git diff --no-index --word-diff "design_handoff_garden_a_v3/baseline/SomeDaisy Garden A v2.html" "design_handoff_garden_a_v3/SomeDaisy Garden A v3.html"
```

Lines in these files are long, so use the word diff. That diff is the precise list of changes. Apply the same changes to the implementation that exists here, following this codebase's structure, naming and conventions. Where this codebase has already moved away from the prototype, keep its way of doing things and port the behavior.

**What to build, in this order**

1. The night sky fix. It is a few values and two shader lines; check Day and Dusk are unchanged.
2. The four new lawn extras (picnic, woodpile, fire pit, pond), their unlock rule, and the grass lying flat under them.
3. The house growing with rank: the `house` option, the five parts, the lift of the roof, and the knock-on changes to the fence, the two shrubs, the pots and the string lights. Drive it from the group's real rank level. Check level 1 looks exactly as the house does today.
4. Pictures in the frames. Use each idea's real images in the order the README gives: uploaded photo, then the image from the idea's link, then the stock photo. The pressed flower stays as the fallback.
5. The card: tapping a frame opens it, with Share, Save and "Add our photo". Wire "Add our photo" to the app's existing upload for an idea if there is one.
6. The Our garden sheet as three tabs, with the 24 colors per part.

**Rules**

- Fidelity is high. Match colors, type, spacing, proportions, timings and easing exactly. Where the README and `garden3d-v3.js` disagree, the file wins.
- The side panel in the prototype (Rank level, Season, Time of day, Motion, Layout, Things done, Send a friend over, Start over) is a review tool. Do not build it into the product.
- The prototype's data is sample data. In particular, the pictures in its frames come from picsum.photos as stand-ins. Do not carry that over; use this app's images.
- Keep every existing tree, shrub and grass blade where it is. The v3 scene spends the same seeded random values as v2; do not reorder the random draws.
- Do not carry over prototype-only code such as the `?v=` cache-buster on the import.
- Read "Changed from v2" and "Things to decide or change for production" in the README before you start. Anything in the second list that needs a product decision, ask me rather than guessing. That includes how this app's ranks map to the six house levels.

**When you are done, tell me**

- What you changed, file by file.
- Anything you could not match exactly, and why.
- Every hook you left unwired (rank level, idea images, upload, share), and what it needs.
- How you checked it: at minimum, the house at each of the six levels by day, at night and in winter; all seven extras on at once; a wall of frames with pictures, with one picture that fails to load; the card's Share and Save on a phone; and the night sky dragged fully left and right.
