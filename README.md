# fuxa-3d-demo

three.js 3D scenes in [FUXA](https://github.com/frangoteam/FUXA) views, built step by step in a tutorial series.
Each episode has its own folder with the scripts and a setup guide. The scripts run as FUXA **CLIENT** scripts, so they need no extra server, plugin or license.

## Episodes

| Folder | Episode | What you learn |
|---|---|---|
| [`01_3d_cube`](01_3d_cube/) | A 3D cube in FUXA | Show a three.js scene in a FUXA view with an open/close script pair: placeholder rectangle, shadow, grid floor, drag along X / Y / Z |
| [`02_cube_modbus`](02_cube_modbus/) | The cube bound to Modbus TCP | Bind the cube to a real output (A-1855 DO0) in both directions: a click switches the output, and the cube's colour follows the output's live state |

Setup steps, settings and notes are in each episode's README. How a script binds to FUXA tags (`$getTagId` / `$getTag` / `$setTag`) is explained in [`02_cube_modbus/README.md`](02_cube_modbus/README.md).

## Requirements

- FUXA (tested with 1.3.2) and a browser for the runtime
- Episode 2: a Modbus TCP device; the videos use the Yottacontrol A-1855 below

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

**Network defaults:** IP `192.168.1.1`, mask `255.255.255.0`, Modbus TCP port `502`, DHCP on (register 40515).

### A-1855 addresses in FUXA

FUXA's Modbus tag **Address offset is 1-based** and the register type is chosen separately, so the addresses in the A-1855 datasheet's Modbus table map directly:

| A-1855 | FUXA tag: Register | Address offset |
|---|---|---|
| DI0 (00001) | Digital Inputs | 1 |
| DO0 (00017) | Coil Status | 17 |
| DO1 (00018) | Coil Status | 18 |
| AM0 (40306) | Holding Registers | 306 |

## Repository layout

```
01_3d_cube/        episode 1: 3d_Cube.js (open script), destroy_Cube.js (close script), README
02_cube_modbus/    episode 2: 3d_Cube_Modbus.js, destroy_Cube_Modbus.js, README
A-1855/            A-1855 datasheet (PDF / HTML) and product photo
```
