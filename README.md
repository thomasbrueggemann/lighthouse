# Skerryhead Light

A first-person Three.js game. You are the keeper of a remote granite lighthouse on a rock in the Atlantic, alone on the night of a full gale. Keep the light burning, make repairs, guide a lost steamer past the reef, and uncover what the old keeper hid inside the tower.

Everything is generated in code: every texture (whitewashed ashlar, plaster, floorboards, granite, verdigris, rugs, quilts), every sound (wind, rain, surf, thunder, foghorn, the cat purring) and all the geometry. There are no asset files, no build step and no dependencies to install. It's static files that load Three.js from a CDN.

**Play it in the browser: https://thomasbrueggemann.github.io/lighthouse/**

## Play locally

ES modules need to be served over HTTP, not opened as `file://`:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Host on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. The game will be live at `https://<user>.github.io/<repo>/` after a minute.

All paths are relative, so it works from a sub-path. The `.nojekyll` file stops Pages from running Jekyll over the files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | walk |
| Shift | hurry (not while carrying paraffin) |
| Mouse | look |
| E / left click | interact (hold for tasks with a progress bar) |
| F | raise or lower the hand lantern |
| J / Tab | relics journal |
| Space | jump |
| Esc | pause |

The menu has a quality setting. **High** turns on real shadows (the moon, lightning through the windows, the lamps nearest you and the lantern in your hand), screen-space ambient occlusion and bloom. **Medium** keeps bloom only, **Low** is for weaker GPUs. Keyboard and mouse are required. If the frame rate stays low on High, the game turns effects down one at a time (resolution scale, occlusion, dynamic shadows, MSAA) and remembers the choice.

## The tower

Nine low-ceilinged storeys (3 m floor to floor, exposed beams, plastered ceilings) wound round by a single spiral stair, with the lantern at 34 m.

| Level | Room |
| --- | --- |
| Lantern (34 m) | Rotating Fresnel optic, salt-crusted glass, iron door to the outside gallery |
| 31 m | Watch room: clockwork that turns the lens, paraffin reservoir & pressure pump |
| 28 m | Lamp workshop: burners, chimneys, a spare lens panel on the polishing table |
| 25 m | Library: walls of books, green banker's lamps |
| 22 m | Study: journal, wireless set, barometer, chart table, the bookcase that hides an alcove |
| 19 m | Assistant keeper's room: bunk bed, model ships |
| 16 m | Keeper's bedroom with a storm-broken window |
| 13 m | Parlour: open fire, harmonium, grandfather clock |
| 10 m | Kitchen: cast-iron range, dresser, Barnacle the cat |
| 7 m | Store room: workbench, barrels, coats, the rug over the trapdoor |
| below | ??? |

Outside there is the oil store with the fog-signal compressor, carved steps down to a landing shelf and jetty (watch out for the waves), a moored rowing boat, and sea stacks off the coast.

The watch is a chain of thirteen tasks, from lighting the stove to writing up the journal. Eight relics of the 1887 keeper Elias Marrow are hidden around the rock: behind loose stones, under floorboards, behind a bookcase, and somewhere beneath the tower. Finding them is optional.

## Code layout

```
index.html        page, HUD, menus, import map (three@0.160.0 from jsDelivr)
css/style.css
js/main.js        renderer, lighting, main loop, debug hooks
js/post.js        post-processing: HDR MSAA target, depth-based AO, dual-filter bloom, tone map & grade
js/config.js      tower dimensions, floors, the spiral stair, windows
js/sky.js         the storm sky (clouds lit by the moon) and the sunrise that follows it, shared by the dome and the sea's reflections
js/lights.js      virtual lamps and the pool of real lights lent to the ones that matter, with shadows
js/textures.js    procedural PBR textures (colour, normal, roughness) and canvas textures
js/materials.js   materials, triplanar wet-rock shader, reflection env map
js/island.js      rock heightfield (chunked), cliffs, sea stacks, steps, jetty, oil store, boat
js/tower.js       walls with real window openings, floors and ceilings, the stair, lantern, lens & beams, cellar, cave
js/furniture.js   the prop library (chamfered furniture, fabrics, lamps, fire) and the stair-zone logic
js/rooms/         one module per storey (store, kitchen, parlour, bedroom, guest, study, library, workshop, watch)
js/interior.js    puts the rooms together, plus the cellar, cave, lantern room, oil store
js/ocean.js       Gerstner-wave ocean (GPU + matching CPU heights), surf foam, beam glints
js/weather.js     storm sky, rain, lightning & thunder, wave spray; once the log is written the storm clears and the lightning light becomes the sun
js/player.js      first-person movement & collision, the hand lantern
js/collision.js   segment/circle walls + raycast ground
js/interact.js    look-and-use interaction system
js/game.js        tasks, inventory, relics & lore, the steamer and its radio
js/audio.js       procedural Web Audio soundscape
js/ui.js          HUD helpers
js/walkcheck.js   dev tool: proves the stairs and every interactive object can be reached
```

### Developer hooks

Open the console on the running game and use `skerry`:

- `skerry.shot(x, y, z, yaw, pitch)` parks the camera and draws a frame (useful in a hidden tab); `skerry.lamp()` lights the lamp.
- `skerry.checkWalk()` flood-fills every storey and reports unreachable stairs or objects; `skerry.checkClimb()` walks a simulated player up every flight to the lantern.
- `skerry.weather.calm = 1` (0 to 1) jumps to the clearing storm and sunrise that follows the final log entry; `skerry.onLogWritten()` plays the real ninety-second transition.
- `skerry.look` holds the interior brightness (`ambientIn`, `exposureIn`, `lampGain`); `skerry.layoutIssues` lists any furniture the placement helpers found on the stairs.
- Add `?bare` to the URL to leave the rooms unfurnished.
