# Skerryhead Light

A first-person Three.js game. You are the keeper of a remote granite lighthouse on a rock in the Atlantic, alone on the night of a full gale. Keep the light burning, make repairs, guide a lost steamer past the reef, and uncover what the old keeper hid inside the tower.

Everything is generated in code: every texture (whitewashed ashlar, plaster, floorboards, granite, verdigris, rugs, quilts), every sound (wind, rain, surf, thunder, foghorn, the cat purring) and all the geometry. There are no asset files, no build step and no dependencies to install. It's static files that load Three.js from a CDN.

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

The menu has a quality setting. **High** turns on shadows (lightning casts shadows through the windows) and bloom, **Medium** keeps bloom only, **Low** is for weaker GPUs. Keyboard and mouse are required.

## The tower

| Level | Room |
| --- | --- |
| Lantern (29.5 m) | Rotating Fresnel optic, salt-crusted glass, iron door to the outside gallery |
| 25.0 m | Watch room: clockwork that turns the lens, paraffin reservoir & pressure pump |
| 20.5 m | Study: journal, wireless set, barometer, chart table, bookcases |
| 16.0 m | Keeper's bedroom with a storm-broken window |
| 11.5 m | Kitchen: cast-iron range, dresser, Barnacle the cat |
| 7.0 m | Store room: tools, spare boards, oilskins, barrels |
| below | ??? |

Outside there is the oil store with the fog-signal compressor, carved steps down to a landing shelf and jetty (watch out for the waves), a moored rowing boat, and sea stacks off the coast.

The watch is a chain of thirteen tasks, from lighting the stove to writing up the journal. Eight relics of the 1887 keeper Elias Marrow are hidden around the rock: behind loose stones, under floorboards, behind a bookcase, and somewhere beneath the tower. Finding them is optional.

## Code layout

```
index.html        page, HUD, menus, import map (three@0.160.0 from jsDelivr)
css/style.css
js/main.js        renderer, post-processing (bloom, rain-on-lens), main loop
js/config.js      tower dimensions, floor heights, stairs, windows
js/textures.js    procedural PBR textures (colour, normal, roughness)
js/materials.js   materials, triplanar wet-rock shader, reflection env map
js/island.js      rock heightfield, cliffs, sea stacks, steps, jetty, oil store, boat
js/tower.js       walls with real window openings, floors, spiral stairs, lantern, lens & beams, cellar, tunnel, cave
js/interior.js    furnishing of every room and all interactions
js/ocean.js       Gerstner-wave ocean (GPU + matching CPU heights), surf foam, beam glints
js/weather.js     storm sky, rain, lightning & thunder, wave spray
js/player.js      first-person movement & collision, hand lantern
js/collision.js   segment/circle walls + raycast ground
js/interact.js    look-and-use interaction system
js/game.js        tasks, inventory, relics & lore, the steamer and its radio
js/audio.js       procedural Web Audio soundscape
js/ui.js          HUD helpers
```
