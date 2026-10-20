# fuxa-3d-demo

three.js 3D scenes in [FUXA](https://github.com/frangoteam/FUXA) views, built step by step in a tutorial series.
Each episode has its own folder with the scripts and a setup guide. The scripts run as FUXA **CLIENT** scripts, so they need no extra server, plugin or license.

## Episodes

| Folder | Episode | What you learn |
|---|---|---|
| [`01_3d_cube`](01_3d_cube/) | A 3D cube in FUXA | Show a three.js scene in a FUXA view with an open/close script pair: placeholder rectangle, shadow, grid floor, drag along X / Y / Z |
| [`02_cube_modbus`](02_cube_modbus/) | The cube bound to Modbus TCP | Bind the cube to a real output (A-1855 DO0) in both directions: a click switches the output, and the cube's colour follows the output's live state |

Each episode builds on the one before it: episode 2 reuses episode 1's view, rectangle and events, and only swaps the two scripts.

## Requirements

- FUXA (tested with 1.3.2) and a browser for the runtime
- Internet access on the PC that opens the runtime: three.js r128 is loaded from cdnjs. On an offline network, point `loadScript(...)` in the scripts to a local copy.
- Episode 2: a Modbus TCP device. The videos use a Yottacontrol A-1855 (below); any Modbus TCP device or simulator with a coil at the same address works.

## How a script binds to FUXA tags

The 3D scripts never talk Modbus themselves. FUXA owns the device connection; a CLIENT script only reads and writes FUXA tags:

| Command | Returns / does |
|---|---|
| `$getTagId(name)` | The tag's **id**, looked up once by the tag name in Connections (an id, not the value) |
| `$getTag(id)` | The tag's **current value**. FUXA adds `await`, so call it inside an `async` function |
| `$setTag(id, value)` | **Writes** a new value; FUXA sends it to the device |

So binding a 3D object to any tag takes three steps: look the id up by name once, read the value on a timer to update the scene, and write a value when the user interacts. See [`02_cube_modbus/README.md`](02_cube_modbus/README.md) for the full example.

## Hardware used in the videos: Yottacontrol A-1855

The A-1855 is an Ethernet remote I/O module with 8 isolated digital inputs and 4 digital outputs (motor-driver outputs). The full datasheet is in [`A-1855/`](A-1855/): [`A-1855.pdf`](A-1855/A-1855.pdf), or [`A-1855.html`](A-1855/A-1855.html) in a browser.

| Item | A-1855 |
|---|---|
| Inputs / outputs | 8 isolated DI (low < 1 VDC, high 5–30 VDC) / 4 DO, motor driver |
| DO continuous current | 8–60 VDC, 1.75 A |
| Isolation | 5000 VDC |
| Switching speed | 10 Hz (inputs and outputs) |
| Power | 10–30 VDC or 24 VAC |
| Interfaces | Ethernet 10/100 Mbps (8 sockets at once) + USB |
| Protocols | Modbus TCP/IP, Modbus RTU; user-defined Modbus addresses |
| Other | Web page for monitoring and control; output protection (OCP / OTP / UVLO) |
| Operating temperature | −20 to +75 °C, IP20 |
| Mounting / size | 35 mm DIN rail or flush; 76.4 × 118.2 × 38.5 mm (W × H × D) |
| Configuration software | Smart Utility / Yotta Utility (free) |

**Network defaults:** IP `192.168.1.1`, mask `255.255.255.0`, Modbus TCP port `502`. **DHCP is on by default** (register 40515), so the module's IP may not be the default: check it with Smart Utility, or set a fixed IP.

### Modbus address map (A-1855 / A-1851 / A-1860 / A-1869)

Access: R = read, R/W = read/write. "Normal" is normal operation; "INIT" is the module's INIT mode as listed in the datasheet (the network settings are writable there).

**Coils and discrete inputs (0X) — function codes 01 / 02 / 05 / 15**

| Address | Item | Normal | INIT |
|---|---|---|---|
| 00001–00016 | DI 0–15 input signal | R | R |
| 00017–00032 | DO 0–15 output value | R/W | R/W |
| 00033–00048 | DO 0–15 power-on output value | R | R/W |
| 00049–00064 | DO 0–15 communication fail-safe value | R | R/W |
| 00129–01152 | Auxiliary memory M0–M1023 (M flag) | R/W | R/W |

**Registers (4X) — function codes 03 / 04 / 06 / 16**

| Address | Item | Normal | INIT | Note |
|---|---|---|---|---|
| 40177 | Communication fail-safe time | R | R/W | 0 = disabled, 1–65535 ms |
| 40178 | All DI value | R | R | |
| 40211–40212 | Module name 1–2 | R | R | |
| 40213–40214 | Version 1–2 | R | R | |
| 40215–40220 | MAC serial number 1–6 | R | R | |
| 40306–40369 | Analog auxiliary memory AM0–AM63 (AM flag) | R/W | R/W | 0–65535 |
| 40500–40503 | Ethernet IP | R | R/W | default 192.168.1.1 |
| 40504–40507 | Ethernet mask | R | R/W | default 255.255.255.0 |
| 40508–40511 | Ethernet gateway | R | R/W | default 192.168.1.1 |
| 40512 | Ethernet Modbus ID | R | R/W | 1–255 (INIT: 0) |
| 40513 | Ethernet local port | R | R/W | default 502 |
| 40514 | Ethernet remote port | R | R/W | default 2000 |
| 40515 | Ethernet DHCP | R | R/W | 0 = enabled (default), 1 = disabled |
| 40516 | Ethernet protocol | R | R | 0 = Modbus TCP/IP (default) |
| 40518–40523 | MAC address | R | R | e.g. 00-05-5D-E8-0F-A3 |

### The same addresses in FUXA

FUXA's Modbus tag **Address offset is 1-based** and the register type is chosen separately, so the A-1855 table maps directly:

| A-1855 | FUXA tag: Register | Address offset |
|---|---|---|
| DI0 (00001) | Digital Inputs | 1 |
| DO0 (00017) | Coil Status | 17 |
| DO1 (00018) | Coil Status | 18 |
| AM0 (40306) | Holding Registers | 306 |

Episode 2 uses one tag: `led_DO0`, Coil Status, address 17 (type Bool). Set the device's **Polling** to 500 ms: with the default 3 sec the 3D view lags behind the module.

## Repository layout

```
01_3d_cube/        episode 1: 3d_Cube.js (open script), destroy_Cube.js (close script), README
02_cube_modbus/    episode 2: 3d_Cube_Modbus.js, destroy_Cube_Modbus.js, README
A-1855/            A-1855 datasheet (PDF / HTML) and product photo
```
