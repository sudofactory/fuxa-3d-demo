# FUXA 3D Model + String Lights

A Sketchfab diorama shown in a FUXA view, with LED string lights hung on it in three groups. Each group is bound to one A-1855 output:

| Group | Where the lights hang | Tag | A-1855 |
|---|---|---|---|
| `house` | Roof edges, eaves, shed roof, umbrella rim, deck railing (the windows light up too) | `led_DO0` | DO0 |
| `dock` | The lamps on the dock posts | `led_DO1` | DO1 |
| `trees` | Spirals around the tree trunks | `led_DO2` | DO2 |

- **Write**: click any string to switch its group's output on or off. The LED on the module follows.
- **Read**: the strings follow the outputs' live state, even when an output is switched from somewhere else.

## Files

| File | Purpose |
|---|---|
| `3d_Forest.js` | Open script, part 1: the model only (orbit and zoom, no tags). Use it to check that the model loads |
| `3d_Forest_Lights.js` | Open script, part 2: the model with the string lights bound to the three tags, a brightness bar and the author's viewpoints |
| `destroy_Forest.js` | Close script for both: releases 3D resources and stops reading the tags |

## Before you start: the model and three.js

The model is not in this repository. Download ["Forest-sided, a peaceful place to live: Diorama"](https://sketchfab.com/3d-models/forest-sided-a-peaceful-place-to-live-diorama-01bde51946244b9db917bf9370ef605b) by CleuzaCosta from Sketchfab (a free account is needed): **Download 3D Model → GLB**. Rename the file to `forest_diorama.glb`.

Put these files in FUXA's `_widgets` folder (`server/_widgets/`, or `<userDir>/_widgets/` when FUXA runs with `--userDir`):

```
_widgets/
  forest_diorama.glb    the model
  three.min.js          from ../lib/ (optional: without it the script loads three.js from the CDN)
  GLTFLoader.js         from ../lib/ (optional, same)
```

### Why `_widgets`

FUXA serves the `_widgets` folder at the web path `/_widgets`, and the script runs in the browser, so it asks the FUXA server for the file the same way it asks for a page:

```js
const MODEL_URL = '/_widgets/forest_diorama.glb';    // FUXA serves the _widgets folder at /_widgets
```

The path has no host or port, so the same script works on any machine that opens the FUXA runtime, with no internet access needed. A file anywhere else on the disk is not served, and the browser can't read it.

## Setup in FUXA

Steps 1 to 4 are the same as episode 1 (see [`../01_3d_cube`](../01_3d_cube/)), with the names below. For the tag binding itself see [`../02_cube_modbus`](../02_cube_modbus/).

### Step 0: Add the device and tags

1. Open **Connections** and add a device: type **ModbusTCP**, the module's IP, port `502`, its Unit ID, **Polling** `500 ms`.
2. Add three tags. Their names must match `OUTPUTS` at the top of `3d_Forest_Lights.js`:

   | Tag name | FUXA memory type | Address |
   |---|---|---|
   | `led_DO0` | Coil Status (read/write) | 17 |
   | `led_DO1` | Coil Status (read/write) | 18 |
   | `led_DO2` | Coil Status (read/write) | 19 |

3. Check that the device status turns green.

### Steps 1 to 4

| | Episode 1 | This episode |
|---|---|---|
| Placeholder rectangle Name | `cube_3d` | `forest_3d` |
| Open script (Mode **CLIENT**) | `3d_Cube.js` | `3d_Forest.js` first, then `3d_Forest_Lights.js` |
| Close script (Mode **CLIENT**) | `destroy_Cube.js` | `destroy_Forest.js` |

A large rectangle works best (for example most of a 1920×1080 view). Save the project after binding the events.

### Test

1. Open the view in the runtime. "Loading model… %" shows while the GLB loads (it is large; the first open takes a few seconds), then the model appears on the same opening view as its Sketchfab page.
2. With `3d_Forest_Lights.js`: click a string on the roof. DO0 on the A-1855 turns on and the whole `house` group lights up. Click again to turn it off. The dock lamps switch DO1, the tree spirals DO2.
3. Switch an output from somewhere else: its group follows within about half a second.

If something doesn't respond, press **F12** and check for messages starting with `[Forest3D]`:

| Message | Cause |
|---|---|
| `Model not found: /_widgets/forest_diorama.glb` (on screen) | The GLB is not in `_widgets`, or its file name is different |
| `找不到 tag "led_DO1"` | The tag name in Connections doesn't match `OUTPUTS` |
| `找不到 "forest_3d"` | The rectangle's Name doesn't match `PLACEHOLDER_ID` |

## Controls

- **Click a string**: switch its group's output (the pointer turns into a hand over a string, and an off group glows faintly)
- **Rotate the view**: left-drag on empty space
- **Zoom**: mouse wheel
- **Viewpoint bar** (top left): the house button returns to the opening view, `1` to `5` fly to the model author's five viewpoints. The numbered markers in the scene do the same
- **Brightness bar** (top right): 20 % to 150 %. It changes the light on the model only, not the LEDs, so turning it down makes the lit strings stand out. The browser remembers the setting

## Settings

At the top of `3d_Forest_Lights.js` (`3d_Forest.js` has the first four):

| Constant | Default | Description |
|---|---|---|
| `PLACEHOLDER_ID` | `'forest_3d'` | Name of the placeholder rectangle |
| `MODEL_URL` | `'/_widgets/forest_diorama.glb'` | Where the model is loaded from |
| `MODEL_SIZE` | `12` | The model's longest side is scaled to this many units |
| `START_VIEW` | Sketchfab's opening camera | Camera position, target and field of view at start (in the model's own units) |
| `BRIGHTNESS` | `1.0` | Model brightness at the first open (later the browser's saved value is used) |
| `OUTPUTS` | `led_DO0` / `led_DO1` / `led_DO2` | The tag of each light group |
| `POLL_MS` | `500` | How often the tags are read (ms) |
| `WRITE_TIMEOUT_MS` | `3000` | After a click, reads are ignored until FUXA reports the new value, or this long at most |
| `LED_COLOR` | `0xffb760` | Bulb glow colour (warm white) |
| `LED_SPACING` | `0.18` | Distance between bulbs |
| `STRINGS` | 24 strings | Where each string hangs and which group it belongs to (`points`, `circle`, `spiral` or `lamp`, in the model's own units) |
| `VIEWPOINTS` | 5 | The author's viewpoints from the Sketchfab page |

## Notes

- `STRINGS`, `START_VIEW` and `VIEWPOINTS` are measured for this one model. With another model, the strings won't line up and need new coordinates.
- Model credit: "Forest-sided, a peaceful place to live: Diorama" by CleuzaCosta, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The script shows the credit line at the bottom left of the 3D area; keep it if you publish your screen or a video.
- three.js r128 and GLTFLoader load from `/_widgets/` first and fall back to the CDN, pinned by SHA-384 hash (SRI), as in episode 1.
