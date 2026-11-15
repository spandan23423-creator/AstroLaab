# 12-item list report (sppppp.txt)

Built 2026-11-15 on top of the Lunar-only build (`SPEC-31-REPORT.md`). Open `index.html`. The game stays Lunar-only.

| # | Item | Cause | Fix | How verified |
|---|---|---|---|---|
| 1 | Lunar Outpost power mission boundary | There was none: you could walk off the edge of the outpost ground | A ring of 48 lit marker posts and a ground line (radius 30 m), drawn unlit so it shows in the crater-rim shadow and from every angle. It is enforced all mission: you are stopped at the line with a reminder. | Test: walking straight at it for 7 s stops at 29.65 m; screenshots |
| 2 | Stars vanish near the centre of the view | The star sphere was fixed in the world (radius 360) while the camera's far plane is 400 m. When you stood away from its centre, stars straight ahead fell past the far plane, so they disappeared in the middle of the screen first. | The star sphere now follows the camera (radius 300), never fogs and is never culled (Moon outpost, EVA, launch, orbit). Moon surface stars are brighter too (0.18 to 0.42 opacity). | Screenshot looking up at the Moon outpost sky |
| 3 | Limit travel to the Moon | Already satisfied: the solar system and every non-Moon site were removed earlier. I found one leftover: the end of Launch Day still had a "Fly to the solar system" button calling the removed game. | That button now goes to the end credits (see 11) | `grep` finds no route outside the Moon |
| 4 | Main TV border behind the screen | The border was only the box behind the picture, 2 mm away, so on big screens it flickered and looked behind it | A raised frame is drawn in front of the picture's edges, and the picture has a depth offset. This covers every wall screen (training dashboard, monitors) and the living-room TV. | Code check; scenes load |
| 5 | Training Center satellite | Very metallic gold with nothing to reflect rendered almost black, and the dish cut into the body (it already sits on a stand since the last update) | Gold-foil body, framed solar wings and a dish on a short boom facing outwards | Code check |
| 6 | Cat and Bug range | They turned head and neck up to 63° to follow you | Their look range is narrowed to about 31° and eased more slowly, at home and at the arrival. I measured both and found no actual drift of their bodies. | Body-position measurement over time |
| 7 | Oxygen rising on the Moon and in space | The outpost O₂ generator pushed oxygen back up towards 21%, and the EVA suit O₂ readout could reset upwards on resume | The generator now only replaces what the crew breathes, so outpost oxygen holds or falls but never climbs. The suit O₂ only goes down. | `node tools/test-sim.mjs` passes |
| 8 | Drive sky | A flat light-blue colour with no clouds | A shared blue gradient sky with soft clouds for the drive, the arrival and launch day; fog colour matched to its horizon. It fades out as the rocket climbs, and the Moon and space keep their black sky. | Screenshots (car, arrival) |
| 9 | Environments with no empty or popping areas | The highway stretch was sparse, scenery appeared at 380 m before the fog hid it, and the van drive to the pad crossed an empty plain | Fuller roadside trees, a ring of distant hills, and scenery that appears only once fully inside the fog. On launch day: trees, lamps, a fence, hangars and hills along the pad road. The flight keeps the space backdrop. | Screenshots during the van drive |
| 10 | Room behind the Controls Practice door | The exit door opened onto the bare back of the wall | A real lit locker room behind a proper doorway (lockers, bench, TRAINING HALL sign and door). The closed door is solid until it opens. | Screenshots before and after opening |
| 11 | End credits | None at the end of the story | A rolling end-credits screen with exactly: ASTRO LAB TEAM / 1. Spandan Shrestha / 2. Ankit Tandukar / 3. Sparsha Kiran Shakta / 4. Suprabha Thapa / 5. Sandesh Maji / 6. Samyam Shrestha. It rolls for about 26 s and has Skip and Main menu buttons (Esc or Enter also skips). It plays after Launch Day in the story, and the team is also listed in Credits on the main menu. | Screenshot at 11 s; Skip returns |
| 12 | Bedroom telescope | The old one was crude (a tube floating over three crossed sticks) and stood by the bedroom door, in the way | A proper refractor on a tripod with a mount, fork, dew shield, eyepiece and finder. It stands by the window, aimed out at the sky, with a small warm lamp, out of the walkway. | Screenshots |

Also re-checked: all 20 training areas load with no console errors, all three Moon sites land and return from the double-clicked `index.html`, and the outpost simulation tests pass.

## Manual QA checklist

- [ ] Moon outpost mission: walk to the yellow markers on all sides and during the shadow; you can't pass and the ring stays visible
- [ ] Look straight up and around at the outpost, EVA and in orbit: stars everywhere, none missing in the middle
- [ ] Outpost power panel: oxygen never goes up during the mission
- [ ] Living-room TV and the training dashboard screen: the frame is in front of the picture
- [ ] Training Centre lobby: satellite on its stand looks right
- [ ] Home and arrival: Bug and Cat only glance at you
- [ ] Drive: blue sky with clouds, full roadside, nothing popping in; launch-day van: trees, fence, hangars
- [ ] Controls Practice: open the exit door and see the locker room
- [ ] Finish Launch Day in the story: the credits roll; Skip and Main menu both work
- [ ] Bedroom: telescope by the window, nothing blocked
