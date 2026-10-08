<div align="center">

# Zalith Control Converter

**Convert Zalith Launcher 1 / Pojav control layouts to Zalith Launcher 2, with accurate position and size.**

[![Deploy](https://github.com/hackfireoffical/Zalith-Control-Converter/actions/workflows/pages.yml/badge.svg)](https://github.com/hackfireoffical/Zalith-Control-Converter/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-dc143c.svg)](LICENSE)
![Runs in browser](https://img.shields.io/badge/runs-100%25%20in%20browser-dc143c)

[**Open the web app**](https://hackfireoffical.github.io/Zalith-Control-Converter/)

</div>

---

## Overview

Zalith Launcher 2 uses a completely different control layout format from Zalith Launcher 1. Position is stored as a fraction of the free screen space, and sizes, styles and key bindings use a new schema. ZL1 layouts cannot be imported directly.

This tool reads a ZL1 layout (`mControlDataList`, version 8) and produces a ZL2 layout (editor version 12) that you can import in Zalith Launcher 2.

- **Accurate positions.** ZL1 stores positions as math expressions (`px()`, `${margin}`, `${width}`, `${screen_width}`, ...). They are evaluated the same way ZL1 does for your screen, then converted to ZL2's position format.
- **Exact sizes.** Sizes are written in `dp`, identical to ZL1, so buttons keep their size on any device.
- **Key bindings preserved.** Single keys, combos (such as F3 + B) and special buttons (keyboard, mouse, scroll, menu) are mapped to ZL2 click events.
- **Private.** Everything runs locally. No backend, nothing is uploaded.
- **Self-check.** After converting, the result is re-rendered and compared with ZL1. The largest position difference is reported.

## Quick start

### Web app

1. Open <https://hackfireoffical.github.io/Zalith-Control-Converter/>.
2. Choose your ZL1 `.json` layout.
3. Set the reference screen. Defaults are 2400 x 1080 px, density 2.75, button scale 100.
4. Tap **Convert**, check any warnings, then **Download ZL2 layout**.
5. Import the downloaded file in Zalith Launcher 2.

### Python script (Termux friendly)

Requires Python 3.9 or newer, no dependencies.

```sh
python3 zl1_to_zl2.py main.json main_zl2.json --w 2400 --h 1080 --density 2.75
```

| Option | Default | Meaning |
|---|---|---|
| `--w` / `--h` | `2400` / `1080` | Screen size in pixels, landscape |
| `--density` | `2.75` | Android display density |
| `--scale` | `100` | ZL1 button scale setting |
| `--name` | file name | Layout name stored in the output |

### Finding your screen values

ZL1 positions depend on the screen they are evaluated on, because expressions mix fixed offsets with screen fractions. For the best result, use the screen size and density of the device you will play on. Layouts that only use screen fractions are unaffected.

## How it works

| ZL1 | ZL2 |
|---|---|
| `dynamicX` / `dynamicY` expressions | `position.x` / `position.y`, 0 to 10000, as `pixel / (screen - widget)` |
| `width` / `height` (dp) | `buttonSize` of type `dp` |
| `keycodes` (GLFW codes, up to 4) | `key` click events (`GLFW_KEY_*`) |
| Keyboard (-1) | launcher event `switch_ime` |
| Mouse left / right / middle (-3, -4, -6) | `GLFW_MOUSE_BUTTON_*` launcher events |
| Scroll up / down (-7, -8) | `scroll_up.single` / `scroll_down.single` |
| Menu (-9) | `switch_menu` |
| `opacity`, `bgColor`, stroke, corner radius | button styles (alpha, ARGB colors, border, radius) |
| `isSwipeable` / `passThruEnabled` / `isToggle` | `isSwipple` / `isPenetrable` / `isToggleable` |
| `displayInGame` / `displayInMenu` | visibility `always` / `in_game` / `in_menu` |
| Joystick | ZL2 joystick (default WASD with Ctrl lock) |

The schema was derived from the source of [ZalithLauncher2](https://github.com/ZalithLauncher/ZalithLauncher2) (`LayerController`) and [ZalithLauncher](https://github.com/ZalithLauncher/ZalithLauncher) (`ControlData`, `ControlInterface`).

## Limitations

- GUI toggle (-2) and virtual mouse (-5) have no ZL2 equivalent. The button is kept, without that action.
- Drawers are not converted.
- Joystick colors are not converted. ZL2 uses separate joystick styles.
- Buttons that fall off-screen on the chosen reference screen are clamped to the edge and listed as warnings.
- Corner radius may look slightly different, because ZL2 applies it differently from ZL1.

## Project structure

```
index.html        Web app page
script.js         Converter logic and UI
style.css         Styling
zl1_to_zl2.py     Standalone Python converter
.github/workflows GitHub Pages deployment
```

## Contributing

Issues and pull requests are welcome. If a layout converts incorrectly, open an issue and attach the ZL1 file along with your screen size and density.

## License

Released under the [MIT License](LICENSE).

This project is not affiliated with or endorsed by the Zalith Launcher or PojavLauncher projects. Zalith Launcher is a trademark of its respective authors.
