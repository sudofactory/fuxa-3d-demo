# fuxa-3d-demo

three.js 3D scenes in [FUXA](https://github.com/frangoteam/FUXA) views, built step by step in a tutorial series.
Each episode has its own folder with the scripts and a setup guide. The scripts run as FUXA **CLIENT** scripts, so they need no extra server, plugin or license.

## Episodes

| Folder | Episode | What you learn |
|---|---|---|
| [`01_3d_cube`](01_3d_cube/) | A 3D cube in FUXA | Show a three.js scene in a FUXA view with an open/close script pair: placeholder rectangle, shadow, grid floor, drag along X / Y / Z |
| [`02_cube_modbus`](02_cube_modbus/) | The cube bound to Modbus TCP | Bind the cube to a real output (A-1855 DO0) in both directions: a click switches the output, and the cube's colour follows the output's live state |
| [`03_forest_house`](03_forest_house/) | A Sketchfab model with string lights | Load a GLB model from FUXA's `_widgets` folder, then hang LED strings on it in three groups bound to A-1855 DO0 / DO1 / DO2: click a string to switch its output, the strings follow the outputs' live state. Brightness bar and the model author's viewpoints included |

Setup steps, settings and notes are in each episode's README. How a script binds to FUXA tags (`$getTagId` / `$getTag` / `$setTag`) is explained in [`02_cube_modbus/README.md`](02_cube_modbus/README.md).

### Episode 3's model (not in this repository)

Episode 3 uses ["Forest-sided, a peaceful place to live: Diorama"](https://sketchfab.com/3d-models/forest-sided-a-peaceful-place-to-live-diorama-01bde51946244b9db917bf9370ef605b) by CleuzaCosta on Sketchfab, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Download it yourself (a free Sketchfab account is needed): **Download 3D Model → GLB**, rename the file to `forest_diorama.glb` and put it in FUXA's `_widgets` folder (`server/_widgets/`, or `<userDir>/_widgets/` when FUXA runs with `--userDir`). The scripts load it from `MODEL_URL = '/_widgets/forest_diorama.glb'`; keep the author credit if you publish your screen.

## Requirements

- FUXA (tested with 1.3.2) and a browser for the runtime

### A-1855 addresses in FUXA

FUXA's Modbus tag **Address offset is 1-based** and the register type is chosen separately, so the addresses in the A-1855 datasheet's Modbus table map directly:

| A-1855 | FUXA tag: Register | Address offset |
|---|---|---|
| DI0 (00001) | Digital Inputs | 1 |
| DO0 (00017) | Coil Status | 17 |
| DO1 (00018) | Coil Status | 18 |
| DO2 (00019) | Coil Status | 19 |
| AM0 (40306) | Holding Registers | 306 |

## Repository layout

```
01_3d_cube/        episode 1: 3d_Cube.js (open script), destroy_Cube.js (close script), README
02_cube_modbus/    episode 2: 3d_Cube_Modbus.js, destroy_Cube_Modbus.js, README
03_forest_house/   episode 3: 3d_Forest.js (model only), 3d_Forest_Lights.js (model + string lights), destroy_Forest.js, README
lib/               three.js r128 and its GLTFLoader: copy into FUXA's _widgets folder to run without internet
A-1855/            A-1855 datasheet (PDF / HTML) and product photo
```
