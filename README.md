# Zalith Control Converter

Converts **Zalith Launcher 1** (and Pojav-style) control layouts into **Zalith Launcher 2** layouts (editor version 12), keeping button positions and sizes accurate.

Two ways to use it:

- **Web app** (GitHub Pages, runs fully in the browser, nothing is uploaded): open `index.html`, pick your layout, set your screen, convert, download.
- **Python script** (works in Termux): `python3 zl1_to_zl2.py in.json out.json --w 2400 --h 1080 --density 2.75`

## How it stays accurate

- ZL1 positions are math expressions (`px()`, `${margin}`, `${width}`, `${screen_width}` ...). They are evaluated for your reference screen, exactly like ZL1 does.
- ZL2 stores position as a fraction of the *free* space, `(screen - widget) * fraction`, so the conversion is `x_px / (screen_width - button_width)` (0-10000).
- Sizes are written as `dp`, identical to ZL1, so they do not drift between devices.
- The tool re-renders the ZL2 result and reports the largest position difference against ZL1.

## Mapping

| ZL1 | ZL2 |
|---|---|
| keycodes (GLFW codes, up to 4) | `key` click events (`GLFW_KEY_*`) |
| Keyboard (-1) | launcher event `switch_ime` |
| Mouse left / right / middle (-3, -4, -6) | `GLFW_MOUSE_BUTTON_*` launcher events |
| Scroll up / down (-7, -8) | `scroll_up.single` / `scroll_down.single` |
| Menu (-9) | `switch_menu` |
| opacity, bgColor, stroke, corner radius | button styles (alpha, ARGB colors, border, radius) |
| isSwipeable / passThruEnabled / isToggle | `isSwipple` / `isPenetrable` / `isToggleable` |
| displayInGame / displayInMenu | visibility `always` / `in_game` / `in_menu` |
| joystick | ZL2 joystick (default WASD + Ctrl lock) |

## Not converted

- GUI toggle (-2) and virtual mouse (-5): no ZL2 equivalent, the button is kept without that action.
- Drawers: no ZL2 equivalent.
- Joystick colors (ZL2 uses separate joystick styles).
- Buttons that evaluate off-screen on the chosen reference screen are clamped to the edge and listed as warnings.

Position depends on the reference screen, because ZL1 expressions mix fixed offsets with screen fractions. Defaults are 2400x1080 at density 2.75.

Schema derived from the ZalithLauncher2 `LayerController` module and ZalithLauncher `ControlData` / `ControlInterface`.
