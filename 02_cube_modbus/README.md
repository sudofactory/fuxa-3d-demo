# FUXA 3D Cube + Modbus TCP

Episode 1's 3D cube, bound to one Modbus TCP coil in both directions:

- **Write**: click the cube to switch A-1855 DO0 on or off. The DO0 LED on the module turns on / off.
- **Read**: the cube glows yellow while DO0 is on, even when DO0 was switched from somewhere else.

Works with an A-1855 module or any Modbus TCP simulator that uses the same address.

## Files

| File | Purpose |
|---|---|
| `3d_Cube_Modbus.js` | Open script: builds the 3D scene and binds it to the tag |
| `destroy_Cube_Modbus.js` | Close script: releases 3D resources and stops reading the tag |

## How the script binds to the tag

The script never talks Modbus itself. FUXA owns the Modbus connection; a CLIENT script reads and writes FUXA tags with three commands:

| Command | Returns / does | Used in `3d_Cube_Modbus.js` |
|---|---|---|
| `$getTagId(name)` | The tag's **id**, looked up by the tag name in Connections. It is an id, not the value. | Once at start: `ledTagId = $getTagId(LED_TAG)` |
| `$getTag(id)` | The tag's **current value** (`1` / `0` for a coil). FUXA adds `await`, so call it inside an `async` function. | Every 0.5 s: `isOn(await $getTag(ledTagId))` |
| `$setTag(id, value)` | **Writes** a new value; FUXA sends it to the device (here Modbus coil 17). | On click: `$setTag(ledTagId, io.led ? 1 : 0)` |

So binding a 3D object to any FUXA tag takes the same three steps: look the id up by name once, read the value on a timer to update the 3D view, and write a value when the user interacts.

**Tip: System functions.** In the script editor, the arrow at the top right opens **System functions**, a list of every FUXA script command (`$setTag`, `$getTag`, `$getTagId`, `$setView`, `$openCard`, …). Click `$setTag` or `$getTag` and a **Tag Selection** dialog lists your tags; pick one and FUXA writes the call at the cursor with that tag's id:

```js
$setTag('t_939f1266-175243f4' /* A-1855 - led_DO0 */, );
```

That id is generated per project, so a script that contains it only works in the project it was written in. This script looks the id up by name with `$getTagId(LED_TAG)` instead, so the same file works in any project that has a tag named `led_DO0`.

## Modbus address (A-1855)

| Tag name | Signal | FUXA memory type | Address |
|---|---|---|---|
| `led_DO0` | DO0 | Coil Status (read/write) | 17 |

FUXA addresses start at 1, so they match the A-1855 address table directly.
Connection: Modbus TCP, port `502`, Unit ID as set on the module (1 to 255).

The A-1855 has DHCP on by default, so its IP may not be the default `192.168.1.1`. Check it with Smart Utility, or set a fixed IP before connecting.

## Setup in FUXA

Steps 1 to 4 are the same as episode 1 (see [`../01_3d_cube`](../01_3d_cube/)). Use the files in this folder and do the extra step below first.

### Step 0: Add the device and tag

1. Open **Connections** and add a device: type **ModbusTCP**, the module's IP, port `502`, and its Unit ID. Set **Polling** to `500 ms`: the default `3 sec` makes the cube lag up to 3 seconds behind the module.
2. Add the tag from the table above. Its name must match `LED_TAG` at the top of `3d_Cube_Modbus.js`.
3. Check that the device status turns green.

Then follow episode 1's steps with `3d_Cube_Modbus.js` as the open script and `destroy_Cube_Modbus.js` as the close script. The placeholder rectangle is still named `cube_3d`.

### Test

1. Click the cube: the DO0 LED on the A-1855 turns on and the cube glows. Click again to turn it off.
2. Switch DO0 from somewhere else (any other Modbus client): the cube follows within about half a second.

If something doesn't respond, press **F12** and check for messages starting with `[CubeModbus]`. A warning that the tag can't be found means the tag name in Connections doesn't match the script.

## Settings

At the top of `3d_Cube_Modbus.js`:

| Constant | Default | Description |
|---|---|---|
| `LED_TAG` | `'led_DO0'` | Tag for the DO0 coil |
| `POLL_MS` | `500` | How often the tag is read (ms) |
| `WRITE_TIMEOUT_MS` | `3000` | After a click, reads are ignored until FUXA reports the new value, or this long at most, so the old value doesn't flip the cube back |
