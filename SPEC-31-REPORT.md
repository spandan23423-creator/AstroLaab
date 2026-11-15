# Spec 31 report: Lunar-only ASTRO LAB, imported models, 31 fixes

Built 2026-11-15. A backup from before these changes is at `../backups/astro-lab-20261115-1256-before-lunar-only.tar.gz`. Nothing is committed yet: the work sits as uncommitted changes on branch `claude/models-and-power-slice`.

**Open `index.html`.** It now carries all 19 imported models inside it, so it works when you double-click it. `astro-lab-standalone.html` is gone because `index.html` replaces it.

## Summary

- **Imported models.** They never showed because `index.html` loaded them from `models/`, and browsers block that when the page is opened from disk. The game then quietly fell back to the built-in models. The models are now embedded in the build. Checked from `file://`: Bug, Cat, the alarm clock, the car, the NASA building, the notice board, the survival crew and the helicopter all load as your models. `~/Downloads/models` is byte-for-byte identical to `models/`.
- **Lunar-only.** Free Explore is removed, along with the solar system, other planets and moons, Mission Archive, Space Logbook, Simulation Lab and Celestial Explorer. The main menu is now New Game · Resume · Training Modules · 🌕 Lunar Mission · Achievements · Settings · Credits · Quit. Lunar Mission opens the three Moon landing sites (Tranquility Base, Hadley–Apennine, Shackleton Rim).
- **Robotic arm removed.** Its module, scene, controls, badge and styles are gone. EVA now unlocks after Spacecraft Systems. An old save that points at the arm scene goes to the training centre instead.
- **Checks.** Every training area (20 scenes) and all three Moon sites load with no console errors. I checked the changed areas with screenshots in headless Brave.

## Per item

| # | Item | Cause | Fix | How verified |
|---|---|---|---|---|
| 1 | Training Center objects flicker | Every ceiling light's glowing panel sat 1 mm under its housing, so the two faces fought for depth (flicker at distance) in every room. I also found a NODE sign and the room title board in the same spot (see 30). | `models/props.js`: panel moved clear of the housing, with a polygon offset | Coplanar-face scan of all 20 scenes; lights no longer flagged |
| 2 | Robotic arm | n/a | Removed (see Summary) | No references left (`grep`); build and all scenes load |
| 3 | Inspection layout | Item 1 on the bench overlapped the log book. The checklist modal had no layout (ragged bullets). | Items get six even slots; the log book moved to the bench end; aligned two-column checklist rows that stack on phones | Screenshots of the bench and modal |
| 4 | Space suit rendering | Not reproduced: the assembled suit renders fully from front, side, back and low angles; the stand pole sits behind the backpack | No change | Four-angle screenshots, all parts installed |
| 5 | Mobility sample box partly rendered | The lid and body shared their top face (z-fighting) | Lid sits on top of the body | Screenshot |
| 6 | Bar collision and gravity | Zero-g handrails ("bars") had no collision, so you floated through them. On foot there was no gravity: walking off a ledge glided you down. | `float.js`: rails are solid capsules (except the one you hold). `fpController.js`: you fall at 9.81 m/s² when you step off a ledge; stairs still step up smoothly. | All scenes load; code paths checked |
| 7 | Buoyancy pool colliders | Only the mock-up module was solid | The work panel, tool bag, safety diver and sign are solid too (plus the handrails, from 6) | Scene loads; boxes match the objects |
| 8 | Alarms and Training Center materials, z-fighting | Same as 1, plus overlapping signs and lid faces (5, 9). The Power Lab breaker labels overlapped each other. | Fixes in 1, 5, 9 and 30; breaker labels scaled to fit their rows | Coplanar-face scan; screenshots |
| 9 | Equipment box partly rendered | The tool bag's lid and body shared a face; the CARGO sign floated in mid-air | Lid on top; sign moved onto the cargo bag's face | Screenshot |
| 10 | Greenhouse display and solar panel | The control-screen post stopped 0.3 m above the floor. The east solar panel overlapped the dome shell. | Post reaches the floor; the solar field and battery moved 3 m west (colliders and build marker too) | Code and collider check |
| 11 | Solar Compass | Earth was shown as a ringed planet 🪐 with mixed emoji and no labels | ☉ Sun and ⊕ Earth, each named underneath, in one font, centred on their bearing | Code and CSS. Your spec text had a redacted part (`__SECRET_1__`), so tell me if it asked for something more specific. |
| 12 | Car render quality | The Golf's metallic paint had nothing to reflect, so it rendered flat and dark | Clear-coated paint with a sky/ground reflection map; glass and chrome reflect too | Before and after screenshots |
| 13 | "Traverse" | The site map's Traverse (skip travel) button | Removed, with its help text and skip counters | `grep` finds no references |
| 14 | Commander Arden | She sat at the very edge of the cot, and her grey bob read as a helmet | Moved onto the mattress; hair darker | Screenshots |
| 15 | Drinking water | The bottle sat low behind the sleeve, and a sip only flexed the hand. A separate bug also commented out the hydration drain. | The bottle is held in view; each sip lifts it to your mouth and tips it; drain restored | Before and after screenshots |
| 16 | Power Lab solar panel angle | The panels stood almost upright under an overhead sun lamp | Tilted back to face the lamp | Screenshot |
| 17 | Load box render order | The LOAD BUS header sat half inside the board; breaker labels overlapped | Header above the board; labels drawn as world UI and resized | Screenshot |
| 18 | Solar panel hitbox | Cable sockets were 9 cm rings, hard to aim at | Every socket has an 11 cm invisible hit sphere (Power Lab and Moon outpost) | Code check |
| 19 | Rover sitting position | The astronaut hovered about 15 cm above and in front of the seat | Hips on the left seat cushion against the backrest | Measured in the scene |
| 20 | Rover direction, wheels, steering | The front wheels turned the opposite way to the rover (and so did the tyre tracks) | Wheel and track yaw sign fixed | Test: W drives forward along the heading; with W+D the rover turns right and the wheels point right |
| 21 | Radio, power panel, lander hitboxes | The radio had no collider and only answered at the end; the lander could not be used; thin parts were hard to aim at | Hit boxes on the radio, lander and power panel; the radio answers any time with a status call; the lander can be inspected; radio collider | Code check; scene loads |
| 22 | All rocks pickable | Only a few named samples could be collected | Every rock in all three Moon sites: rocks up to 0.8 m go into your sample bag (removed, saved, count toward sample objectives); bigger boulders give one chipped sample | Test: pick-up and chip prompts appear and work |
| 24 | Sprint animation | In low gravity the lope kept a fixed beat at every speed, so feet skated when running fast | Hop cadence follows ground speed; leg swing grows with speed | Code check |
| 25 | NPC heights and ground | Built-in NPCs' shoes sat about 2 cm below the floor | Each person is lifted so its lowest point is exactly on the floor. Imported NPC heights match their character heights (1.63 to 1.83 m). | Measured all NPCs in 11 scenes |
| 26 | Hand animation | Small items rested flat on the palm and the sleeve filled the screen corner | The hand wraps the side of small items, palm facing them; shorter, slimmer sleeve | Screenshot |
| 27 | EVA hitboxes and grabbing | Outside, only the truss was solid | The airlock module, antenna mast and dish, mount plate and tool bag are solid; handrails are solid (6) | Scene loads |
| 28 | Launch Day van and environment | The van was a solid box around the camera, so its faces were culled and it stayed behind while you moved | An open cabin with seats, pillars and windows that drives with you; road, pad and rocket visible | Screenshots during the drive |
| 29 | Mars moon flat terrain after 800 m jumps | Phobos (and all non-Moon sites) are gone under the Lunar-only scope | Removed cleanly | `grep` |
| 30 | Emergency drill node and station stacked | The NODE sign sat exactly on the STATION MOCK-UP title board. The two crew also walked the same hatch line at the same time, and their colliders stayed behind after a resume. | NODE sign moved below the title board; crew use separate lanes, one waits a moment; colliders follow them on resume | Screenshot |
| 31 | First-person look | Seated views (car, van, capsule, cockpit, bed, raft) clamped turning to about ±70°. Mouse look only worked by left-drag until you clicked. | Seated turning about ±115° with more up/down range; right-drag also looks around (no context menu) | Code check |

## Removed content

- **Free Explore and its screens:** the solar-system game (`js/scene/solarScene.js`), briefing, HUD and toolbar (`js/ui/hud.js`), Mission Archive (`js/ui/archive.js`, `js/data/archive.js`), Celestial Explorer (`js/data/objects.js`), Simulation Lab (`js/ui/lab.js`, `js/sims/*`), journal, map, scale, help and logbook dialogs (from `js/ui/modals.js`, which now holds only Settings), and the solar-system data (`js/data/solarSystem.js`).
- **Mission engine:** the story, survey, daily and sim missions in `js/data/missions.js` and `js/systems/core.js`. Missions now hold only the badges: Moon expedition badges plus training badges.
- **Non-Moon surface content:** Io, Europa, Ganymede, Callisto, Titan, Enceladus, Triton, Charon and Phobos (bodies, sites, terrain colouring, lava, rings, plumes). Their nine map textures were deleted, and `moonMaps.js` dropped from about 1 MB to 317 KB.
- **Robotic arm:** `js/career/scenes/robotics.js`, its module, badge, controls row and CSS.
- **Other:** the "Traverse" skip; `astro-lab-standalone.html`.
- **Added:** `js/scene/menuBackdrop.js` (the Moon and Earth behind the main menu).

## Assumptions, and items needing your eye

- "Lunar Mission" means the Moon surface expeditions (rover, rocks, lander) plus the Lunar Outpost Power mission. All astronaut training stays, because the spec lists fixes in it.
- Item 11's text was partly redacted in the spec I received.
- Items 4 and 14: I fixed what I could see. If you have a specific angle or moment where the suit or Arden looks wrong, a screenshot would help.
- Some inert code from the other moons is still in `surfaceGame.js` (jetpack, Titan air drag). It never runs on the Moon. I left it to avoid risky edits in a 1,000-line file.

## QA checklist

- [x] `index.html` opened by double-click shows your models (home: Bug, Cat, alarm clock)
- [x] Main menu has no Free Explore, Mission Archive or Space Logbook
- [x] Lunar Mission: all three Moon sites land and lift off back to the menu
- [x] All 20 training areas load with no console errors
- [x] Rover: boards, sits on the seat, drives forward, steers with matching wheels
- [x] Rocks: pick up small rocks, chip boulders, both count as samples
- [x] Robotic arm: absent from menus, dashboard, controls and badges
- [ ] Play through each training module on your machine with real mouse and keyboard (not possible headlessly)
