# Moon map credits

`moon.jpg` is the global colour map of Earth's Moon, used for the Moon on the main-menu backdrop. It is embedded in the
game as `js/data/moonMaps.js` so the game works offline and from a double-clicked `index.html`. If it cannot be decoded,
the game keeps its generated Moon texture.

(The game is now Lunar-only. The maps of the other moons that earlier builds shipped were removed with Free Explore.)

| File | Size | Source and author (as stated by the source) | Licence | What was changed |
|---|---|---|---|---|
| `moon.jpg` | 2048 x 1024 | Ruslan Kabatsayev, from Hapke-normalised LROC WAC data (NASA / GSFC / Arizona State University), [Stellarium](https://github.com/Stellarium/stellarium) `moon_4k.jpg` (commit `1b75fca9`, credits in its `CREDITS.md` section 4) | **CC BY-SA 4.0** | Resized from 4096 x 2048, dimmed to 80% |

Notes:

* **Share-alike.** `moon.jpg` is CC BY-SA. If you publish the game, keep this file (and `js/data/moonMaps.js`, which embeds it)
  under the same licence and keep the credit line. The game code itself is not affected. If that is a problem, delete the
  entry from `moonMaps.js` and the game falls back to its generated texture.
* The map is an albedo (brightness and colour) map, not elevation.

## Rebuilding

`tools/moon-maps/make_final.py` and `proc.py` show how the map was produced. `python3 tools/moon-maps/embed.py` (run from
the repository root) regenerates `js/data/moonMaps.js` from the `.jpg` files here.
