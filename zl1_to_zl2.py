#!/usr/bin/env python3
"""Convert a Zalith Launcher 1 control layout (version 8) to Zalith Launcher 2 (editorVersion 12).

Usage: python3 zl1_to_zl2.py in.json out.json [--w 2400] [--h 1080] [--density 2.75] [--scale 100] [--name NAME]

Schema derived from ZalithLauncher2/LayerController and ZalithLauncher ControlData/ControlInterface.
"""
import argparse, json, re, sys, uuid

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--w", type=float, default=2400)       # physicalWidth (landscape px)
ap.add_argument("--h", type=float, default=1080)       # physicalHeight
ap.add_argument("--density", type=float, default=2.75)
ap.add_argument("--scale", type=float, default=100)    # ZL1 button scale pref
ap.add_argument("--name", default=None)
a = ap.parse_args()

W, H, D = a.w, a.h, a.density
MARGIN = int(2 * D)
src = json.load(open(a.src, encoding="utf-8"))
scaled_at = src.get("scaledAt", 100) or 100
warnings = []

def rid(n): return uuid.uuid4().hex[:n]
def px(dp): return dp * D
def dp(p): return p / D

def evaluate(expr, w_px, h_px):
    vars_ = {"top": 0, "left": 0, "right": W - w_px, "bottom": H - h_px, "width": w_px,
             "height": h_px, "screen_width": W, "screen_height": H, "margin": MARGIN,
             "preferred_scale": a.scale}
    e = re.sub(r"\$\{(\w+)\}", lambda m: repr(float(vars_[m.group(1)])), expr)
    return float(eval(e, {"__builtins__": {}}, {"px": px, "dp": dp}))

GLFW = {32: "SPACE", 39: "APOSTROPHE", 44: "COMMA", 45: "MINUS", 46: "PERIOD", 47: "SLASH",
        59: "SEMICOLON", 61: "EQUAL", 91: "LEFT_BRACKET", 92: "BACKSLASH", 93: "RIGHT_BRACKET",
        96: "GRAVE_ACCENT", 256: "ESCAPE", 257: "ENTER", 258: "TAB", 259: "BACKSPACE",
        260: "INSERT", 261: "DELETE", 262: "RIGHT", 263: "LEFT", 264: "DOWN", 265: "UP",
        266: "PAGE_UP", 267: "PAGE_DOWN", 268: "HOME", 269: "END", 280: "CAPS_LOCK",
        281: "SCROLL_LOCK", 282: "NUM_LOCK", 283: "PRINT_SCREEN", 284: "PAUSE",
        330: "KP_DECIMAL", 331: "KP_DIVIDE", 332: "KP_MULTIPLY", 333: "KP_SUBTRACT",
        334: "KP_ADD", 335: "KP_ENTER", 336: "KP_EQUAL", 340: "LEFT_SHIFT",
        341: "LEFT_CONTROL", 342: "LEFT_ALT", 343: "LEFT_SUPER", 344: "RIGHT_SHIFT",
        345: "RIGHT_CONTROL", 346: "RIGHT_ALT", 347: "RIGHT_SUPER", 348: "MENU"}
for i in range(10): GLFW[48 + i] = str(i); GLFW[320 + i] = f"KP_{i}"
for i in range(26): GLFW[65 + i] = chr(65 + i)
for i in range(25): GLFW[290 + i] = f"F{i+1}"

SPECIAL = {
    -1: ("launcher_event", "launcher.event.switch_ime"),
    -3: ("launcher_event", "GLFW_MOUSE_BUTTON_LEFT"),
    -4: ("launcher_event", "GLFW_MOUSE_BUTTON_RIGHT"),
    -6: ("launcher_event", "GLFW_MOUSE_BUTTON_MIDDLE"),
    -7: ("launcher_event", "launcher.event.scroll_up.single"),
    -8: ("launcher_event", "launcher.event.scroll_down.single"),
    -9: ("launcher_event", "launcher.event.switch_menu"),
}

def events(keycodes, label):
    out = []
    for k in keycodes:
        if k == 0: continue
        if k in SPECIAL:
            t, key = SPECIAL[k]; out.append({"type": t, "key": key})
        elif k in GLFW:
            out.append({"type": "key", "key": "GLFW_KEY_" + GLFW[k]})
        else:
            warnings.append(f"'{label}': keycode {k} has no ZL2 equivalent (dropped)")
    return out

def argb(v): return v & 0xFFFFFFFF

def over_white(c, a_w=60 / 255):  # ZL1 pressed overlay: white @ alpha 60
    al = ((c >> 24) & 255) / 255
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    oa = a_w + al * (1 - a_w)
    f = lambda x: round((255 * a_w + x * al * (1 - a_w)) / oa)
    return (round(oa * 255) << 24) | (f(r) << 16) | (f(g) << 8) | f(b)

styles, style_key = [], {}
def get_style(d, w_px, h_px):
    radius = min(100.0, round(min(w_px, h_px) / 2 * d["cornerRadius"] / 100, 2))
    bw = int(round(d["strokeWidth"]))
    key = (d["opacity"], d["bgColor"], d["strokeColor"], bw, radius)
    if key in style_key: return style_key[key]
    shape = {"topStart": radius, "topEnd": radius, "bottomEnd": radius, "bottomStart": radius}
    def cfg(bg):
        return {"alpha": d["opacity"], "pressedAlpha": d["opacity"],
                "backgroundColor": argb(d["bgColor"]), "pressedBackgroundColor": argb(bg),
                "contentColor": 0xFFFFFFFF, "pressedContentColor": 0xFFFFFFFF,
                "fontSize": 14, "pressedFontSize": 14,
                "borderWidth": bw, "pressedBorderWidth": bw,
                "borderColor": argb(d["strokeColor"]), "pressedBorderColor": argb(d["strokeColor"]),
                "borderRadius": shape, "pressedBorderRadius": shape}
    c = cfg(over_white(argb(d["bgColor"])))
    sid = rid(12)
    styles.append({"name": f"Style {len(styles)+1}", "uuid": sid, "animateSwap": False,
                   "commonStyle": True, "lightStyle": c, "darkStyle": c})
    style_key[key] = sid
    return sid

def position(d, w_px, h_px, label):
    x = evaluate(d["dynamicX"], w_px, h_px); y = evaluate(d["dynamicY"], w_px, h_px)
    fx = x / (W - w_px) if W > w_px else 0
    fy = y / (H - h_px) if H > h_px else 0
    if not (0 <= fx <= 1 and 0 <= fy <= 1):
        warnings.append(f"'{label}': off-screen (x={x:.0f}, y={y:.0f}px), clamped")
    cx, cy = min(max(fx, 0), 1), min(max(fy, 0), 1)
    return {"x": round(cx * 10000), "y": round(cy * 10000)}, (x, y)

def vis(d):
    g, m = d["displayInGame"], d["displayInMenu"]
    return "always" if g == m else ("in_game" if g else "in_menu")

def size_obj(wdp, hdp, w_px, h_px):
    pw = max(100, min(10000, round(h_px / H * 10000)))
    pw_w = max(100, min(10000, round(w_px / H * 10000)))
    return {"type": "dp", "widthDp": max(5.0, wdp), "heightDp": max(5.0, hdp),
            "widthPercentage": pw_w, "heightPercentage": pw,
            "widthReference": "screen_height", "heightReference": "screen_height"}

buttons, checks = [], []
for d in src["mControlDataList"]:
    label = d["name"]
    wdp = d["width"] / scaled_at * a.scale; hdp = d["height"] / scaled_at * a.scale
    w_px, h_px = px(wdp), px(hdp)
    pos, (x, y) = position(d, w_px, h_px, label)
    buttons.append({
        "text": {"default": label.strip(), "matchQueue": []},
        "uuid": rid(18), "position": pos, "buttonSize": size_obj(wdp, hdp, w_px, h_px),
        "buttonStyle": get_style(d, w_px, h_px), "textAlignment": "Center",
        "textBold": False, "textItalic": False, "textUnderline": False,
        "visibilityType": vis(d), "clickEvents": events(d["keycodes"], label),
        "isSwipple": d["isSwipeable"], "isPenetrable": d["passThruEnabled"],
        "isToggleable": d["isToggle"]})
    checks.append((label, x, y, w_px, h_px, pos))

joysticks = []
for d in src.get("mJoystickDataList", []):
    wdp = d["width"] / scaled_at * a.scale
    w_px = px(wdp); h_px = px(d["height"] / scaled_at * a.scale)
    pos, (x, y) = position(d, w_px, h_px, "joystick")
    joysticks.append({"uuid": rid(18), "position": pos, "sizeType": "dp",
                      "sizeDp": max(20.0, wdp), "sizePercentage": max(2000, round(w_px / H * 10000)),
                      "visibilityType": vis(d)})
    checks.append(("joystick", x, y, w_px, h_px, pos))

if src.get("mDrawerDataList"):
    warnings.append(f"{len(src['mDrawerDataList'])} drawer(s) not converted (no ZL2 equivalent)")

info = src.get("mControlInfoDataList") or {}
clean = lambda v: "" if v in (None, "null") else v
name = a.name or clean(info.get("name")) or a.src.rsplit("/", 1)[-1].removesuffix(".json")
ts = lambda s: {"default": s, "matchQueue": []}
out = {"info": {"name": ts(name), "author": ts(clean(info.get("author"))),
                "description": ts(clean(info.get("desc"))), "versionCode": 1, "versionName": "1.0"},
       "layers": [{"name": "Layer 1", "uuid": rid(12), "hide": False, "hideWhenMouse": True,
                   "hideWhenGamepad": True, "visibilityType": "always",
                   "normalButtons": buttons, "textBoxes": [], "joystickButtons": joysticks}],
       "styles": styles, "joystickStyles": [], "editorVersion": 12}
json.dump(out, open(a.dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# verify: re-render ZL2 positions and compare with ZL1 evaluation
worst = 0
for label, x, y, w, h, pos in checks:
    rx, ry = (W - w) * pos["x"] / 10000, (H - h) * pos["y"] / 10000
    worst = max(worst, abs(rx - x), abs(ry - y))
print(f"{len(buttons)} buttons, {len(joysticks)} joystick(s), {len(styles)} styles")
print(f"max position error vs ZL1 at {W:.0f}x{H:.0f} d={D}: {worst:.2f}px")
for w_ in warnings: print("WARN:", w_)
