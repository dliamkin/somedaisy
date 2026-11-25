# Prompt for Claude Code

Put this folder (`design_handoff_group_header_1d/`) in the root of the repository where the SomeDaisy app lives, then paste everything below the line into Claude Code.

---

The group screen is already built in this codebase. The folder `design_handoff_group_header_1d/` holds a small design change to the top of it: the strip between the photo and "Coming up". Your job is to apply that change to the existing screen. Do not rebuild the screen, and do not ship the HTML mock itself.

**Read first**

1. `design_handoff_group_header_1d/README.md`, all of it. It has every size, color, gap and piece of copy.
2. `design_handoff_group_header_1d/baseline/group-screen-today.jpg`. That is the screen as it ships now. Then `design_handoff_group_header_1d/screenshots/after-1d.png`, which is the target.
3. `design_handoff_group_header_1d/SomeDaisy Group Header 1d.dc.html`. The markup uses inline styles, so the values can be read straight from the source. The block with `data-ab="now"` is today's screen; the block with `data-ab="1d"` is the change.
4. Find the group screen in this codebase. Searching for the text `Grow your group's petals!` should land on it. Before changing anything, note what the tulip, calendar and trophy buttons and the "See all" link each do today.

**What to build, in this order**

1. The rank strip: full width, current rank and next rank named, "N to go" and a caret on the right, the bar underneath with the dashed goal ring. Make the whole strip open what the trophy button opens today.
2. Remove the three round icon buttons.
3. The Calendar pill at the right of the "Coming up" row, opening what the calendar button opens today. Its tap target is 44 high but the row must stay the height it is now.
4. The Garden pill on the seam between the photo and the sheet, opening what the tulip button opens today.
5. The daisy's spin when tapped. It does not navigate anywhere.

**Rules**

- Fidelity is high for layout, sizes, spacing and copy. Where the README and the `.dc.html` file disagree, the file wins.
- The colors in the README were sampled from a screenshot. Where this codebase has a token for the same role, use the token rather than the hex value. Do the same for the font and for the text styles of elements that already exist on the screen.
- Build it with theme tokens so the light theme follows. Only the dark theme is drawn.
- Use this app's icon set. The mock's icons were picked to match what is already on the screen.
- Every tap target is at least 44 high.
- The photo, avatars, daisy and event card in the mock are crops of a screenshot. The labels, notes and Tweaks around the screens are review tools. Do not build any of that.
- "Thrill Seekers" is a stand-in. Take the next rank's name from the rank ladder that already exists in this codebase.
- Read "Decided" and "Still open" in the README before you start. "See all" is removed; the Calendar pill replaces it. Do not build the prestige prompt or the daisy's easter egg yet. Ask me about anything under "Still open" rather than guessing.

**When you are done, tell me**

- What you changed, file by file.
- Anything you could not match exactly, and why.
- Where you read the next rank's name from.
- How you checked it: at minimum, progress at 0, at about 8% and at 100; a long rank name; a long photo credit; a group with no photo credit; a group at the top rank; the light theme; the daisy's spin with reduced motion on and off; and each of the three taps going to the right place on a phone.
