"use strict";

/* ---------- GLFW key names (standard GLFW codes) ---------- */
const GLFW_NAMES = (() => {
  const m = {
    32: "SPACE", 39: "APOSTROPHE", 44: "COMMA", 45: "MINUS", 46: "PERIOD", 47: "SLASH",
    59: "SEMICOLON", 61: "EQUAL", 91: "LEFT_BRACKET", 92: "BACKSLASH", 93: "RIGHT_BRACKET",
    96: "GRAVE_ACCENT", 256: "ESCAPE", 257: "ENTER", 258: "TAB", 259: "BACKSPACE",
    260: "INSERT", 261: "DELETE", 262: "RIGHT", 263: "LEFT", 264: "DOWN", 265: "UP",
    266: "PAGE_UP", 267: "PAGE_DOWN", 268: "HOME", 269: "END", 280: "CAPS_LOCK",
    281: "SCROLL_LOCK", 282: "NUM_LOCK", 283: "PRINT_SCREEN", 284: "PAUSE",
    330: "KP_DECIMAL", 331: "KP_DIVIDE", 332: "KP_MULTIPLY", 333: "KP_SUBTRACT",
    334: "KP_ADD", 335: "KP_ENTER", 336: "KP_EQUAL", 340: "LEFT_SHIFT",
    341: "LEFT_CONTROL", 342: "LEFT_ALT", 343: "LEFT_SUPER", 344: "RIGHT_SHIFT",
    345: "RIGHT_CONTROL", 346: "RIGHT_ALT", 347: "RIGHT_SUPER", 348: "MENU",
  };
  for (let i = 0; i < 10; i++) { m[48 + i] = String(i); m[320 + i] = "KP_" + i; }
  for (let i = 0; i < 26; i++) m[65 + i] = String.fromCharCode(65 + i);
  for (let i = 0; i < 25; i++) m[290 + i] = "F" + (i + 1);
  return m;
})();

/* ZL1 special buttons -> ZL2 launcher events. -2 (GUI toggle) and -5 (virtual mouse) have no equivalent. */
const SPECIAL = {
  "-1": ["launcher_event", "launcher.event.switch_ime"],
  "-3": ["launcher_event", "GLFW_MOUSE_BUTTON_LEFT"],
  "-4": ["launcher_event", "GLFW_MOUSE_BUTTON_RIGHT"],
  "-6": ["launcher_event", "GLFW_MOUSE_BUTTON_MIDDLE"],
  "-7": ["launcher_event", "launcher.event.scroll_up.single"],
  "-8": ["launcher_event", "launcher.event.scroll_down.single"],
  "-9": ["launcher_event", "launcher.event.switch_menu"],
};

/* ---------- safe math evaluator (no eval) for ZL1 dynamicX / dynamicY ---------- */
function evalMath(str, fns) {
  let i = 0;
  const ws = () => { while (i < str.length && /\s/.test(str[i])) i++; };
  const expect = (c) => {
    ws();
    if (str[i] !== c) throw new Error(`Expected '${c}' at ${i} in: ${str}`);
    i++;
  };
  function expr() {
    let v = term(); ws();
    while (str[i] === "+" || str[i] === "-") {
      const op = str[i++]; const r = term();
      v = op === "+" ? v + r : v - r; ws();
    }
    return v;
  }
  function term() {
    let v = unary(); ws();
    while (str[i] === "*" || str[i] === "/") {
      const op = str[i++]; const r = unary();
      v = op === "*" ? v * r : v / r; ws();
    }
    return v;
  }
  function unary() {
    ws();
    if (str[i] === "-") { i++; return -unary(); }
    if (str[i] === "+") { i++; return unary(); }
    return primary();
  }
  function primary() {
    ws();
    if (str[i] === "(") { i++; const v = expr(); expect(")"); return v; }
    const rest = str.slice(i);
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest);
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const fn = /^([a-z_]+)\s*\(/i.exec(rest);
    if (fn) {
      if (!fns[fn[1]]) throw new Error("Unknown function: " + fn[1]);
      i += fn[0].length;
      const arg = expr(); expect(")");
      return fns[fn[1]](arg);
    }
    throw new Error(`Unexpected token at ${i} in: ${str}`);
  }
  const result = expr(); ws();
  if (i !== str.length) throw new Error(`Trailing input at ${i} in: ${str}`);
  return result;
}

/* ---------- helpers ---------- */
const hex = (n) => {
  const b = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").slice(0, n);
};
const argb = (v) => v >>> 0;

/* ZL1 draws a white overlay (alpha 60/255) while a button is pressed */
function overWhite(c, aw = 60 / 255) {
  const al = ((c >>> 24) & 255) / 255;
  const r = (c >>> 16) & 255, g = (c >>> 8) & 255, b = c & 255;
  const oa = aw + al * (1 - aw);
  const f = (x) => Math.round((255 * aw + x * al * (1 - aw)) / oa);
  return (((Math.round(oa * 255) << 24) | (f(r) << 16) | (f(g) << 8) | f(b)) >>> 0);
}

/* ---------- conversion ---------- */
function convert(src, o) {
  const { W, H, D, scale } = o;
  const margin = Math.trunc(2 * D);
  const scaledAt = src.scaledAt || 100;
  const warnings = [];
  const styles = [];
  const styleKey = new Map();
  const checks = [];
  const fns = { px: (v) => v * D, dp: (v) => v / D };

  const evaluate = (expr, wPx, hPx) => {
    const vars = {
      top: 0, left: 0, right: W - wPx, bottom: H - hPx, width: wPx, height: hPx,
      screen_width: W, screen_height: H, margin, preferred_scale: scale,
    };
    const filled = String(expr).replace(/\$\{(\w+)\}/g, (_, n) => {
      if (!(n in vars)) throw new Error("Unknown variable: " + n);
      return "(" + vars[n] + ")";
    });
    return evalMath(filled, fns);
  };

  const events = (keycodes, label) => {
    const out = [];
    for (const k of keycodes || []) {
      if (k === 0) continue;
      if (SPECIAL[k]) out.push({ type: SPECIAL[k][0], key: SPECIAL[k][1] });
      else if (GLFW_NAMES[k]) out.push({ type: "key", key: "GLFW_KEY_" + GLFW_NAMES[k] });
      else warnings.push(`'${label}': keycode ${k} has no ZL2 equivalent (dropped)`);
    }
    return out;
  };

  const getStyle = (d, wPx, hPx) => {
    const radius = Math.min(100, Math.round((Math.min(wPx, hPx) / 2) * (d.cornerRadius || 0)) / 100);
    const bw = Math.round(d.strokeWidth || 0);
    const key = JSON.stringify([d.opacity, d.bgColor, d.strokeColor, bw, radius]);
    if (styleKey.has(key)) return styleKey.get(key);
    const shape = { topStart: radius, topEnd: radius, bottomEnd: radius, bottomStart: radius };
    const bg = argb(d.bgColor), stroke = argb(d.strokeColor);
    const cfg = {
      alpha: d.opacity, pressedAlpha: d.opacity,
      backgroundColor: bg, pressedBackgroundColor: overWhite(bg),
      contentColor: 0xFFFFFFFF, pressedContentColor: 0xFFFFFFFF,
      fontSize: 14, pressedFontSize: 14,
      borderWidth: bw, pressedBorderWidth: bw,
      borderColor: stroke, pressedBorderColor: stroke,
      borderRadius: shape, pressedBorderRadius: shape,
    };
    const id = hex(12);
    styles.push({
      name: "Style " + (styles.length + 1), uuid: id, animateSwap: false,
      commonStyle: true, lightStyle: cfg, darkStyle: cfg,
    });
    styleKey.set(key, id);
    return id;
  };

  const position = (d, wPx, hPx, label) => {
    const dx = d.dynamicX ?? String(d.x ?? 0);
    const dy = d.dynamicY ?? String(d.y ?? 0);
    if (d.dynamicX == null) warnings.push(`'${label}': old format without dynamicX, used raw x/y as pixels`);
    const x = evaluate(dx, wPx, hPx), y = evaluate(dy, wPx, hPx);
    const fx = W > wPx ? x / (W - wPx) : 0;
    const fy = H > hPx ? y / (H - hPx) : 0;
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) {
      warnings.push(`'${label}': off-screen (x=${Math.round(x)}, y=${Math.round(y)}px), clamped`);
    }
    const c = (v) => Math.min(Math.max(v, 0), 1);
    return { pos: { x: Math.round(c(fx) * 10000), y: Math.round(c(fy) * 10000) }, x, y };
  };

  const vis = (d) => {
    const g = !!d.displayInGame, m = !!d.displayInMenu;
    return g === m ? "always" : g ? "in_game" : "in_menu";
  };

  const buttons = [];
  for (const d of src.mControlDataList || []) {
    const label = d.name ?? "";
    const wdp = (d.width / scaledAt) * scale, hdp = (d.height / scaledAt) * scale;
    const wPx = wdp * D, hPx = hdp * D;
    const p = position(d, wPx, hPx, label);
    buttons.push({
      text: { default: label.trim(), matchQueue: [] },
      uuid: hex(18),
      position: p.pos,
      buttonSize: {
        type: "dp", widthDp: Math.max(5, wdp), heightDp: Math.max(5, hdp),
        widthPercentage: Math.max(100, Math.min(10000, Math.round((wPx / H) * 10000))),
        heightPercentage: Math.max(100, Math.min(10000, Math.round((hPx / H) * 10000))),
        widthReference: "screen_height", heightReference: "screen_height",
      },
      buttonStyle: getStyle(d, wPx, hPx),
      textAlignment: "Center", textBold: false, textItalic: false, textUnderline: false,
      visibilityType: vis(d),
      clickEvents: events(d.keycodes, label),
      isSwipple: !!d.isSwipeable, isPenetrable: !!d.passThruEnabled, isToggleable: !!d.isToggle,
    });
    checks.push([p.x, p.y, wPx, hPx, p.pos]);
  }

  const joysticks = [];
  for (const d of src.mJoystickDataList || []) {
    const wdp = (d.width / scaledAt) * scale;
    const wPx = wdp * D, hPx = ((d.height / scaledAt) * scale) * D;
    const p = position(d, wPx, hPx, "joystick");
    joysticks.push({
      uuid: hex(18), position: p.pos, sizeType: "dp", sizeDp: Math.max(20, wdp),
      sizePercentage: Math.max(2000, Math.round((wPx / H) * 10000)),
      visibilityType: vis(d),
    });
    checks.push([p.x, p.y, wPx, hPx, p.pos]);
  }

  if ((src.mDrawerDataList || []).length) {
    warnings.push(`${src.mDrawerDataList.length} drawer(s) not converted (no ZL2 equivalent)`);
  }

  const info = src.mControlInfoDataList || {};
  const clean = (v) => (v == null || v === "null" ? "" : v);
  const ts = (s) => ({ default: s, matchQueue: [] });
  const layout = {
    info: {
      name: ts(o.name || clean(info.name) || "layout"),
      author: ts(clean(info.author)),
      description: ts(clean(info.desc)),
      versionCode: 1, versionName: "1.0",
    },
    layers: [{
      name: "Layer 1", uuid: hex(12), hide: false, hideWhenMouse: true, hideWhenGamepad: true,
      visibilityType: "always", normalButtons: buttons, textBoxes: [], joystickButtons: joysticks,
    }],
    styles, joystickStyles: [], editorVersion: 12,
  };

  let worst = 0;
  for (const [x, y, w, h, pos] of checks) {
    worst = Math.max(worst,
      Math.abs((W - w) * pos.x / 10000 - x),
      Math.abs((H - h) * pos.y / 10000 - y));
  }
  return { layout, warnings, stats: { buttons: buttons.length, joysticks: joysticks.length, styles: styles.length, worst } };
}

/* ---------- UI ---------- */
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  let src = null, srcName = "layout", out = null;

  const showError = (msg) => { $("error").textContent = msg; $("error").hidden = false; };
  const clearError = () => { $("error").hidden = true; };

  $("file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    out = null; $("result").hidden = true; clearError();
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.editorVersion != null) throw new Error("This already looks like a ZL2 layout.");
      if (!Array.isArray(data.mControlDataList)) throw new Error("Not a Zalith 1 / Pojav layout (mControlDataList missing).");
      src = data;
      srcName = f.name.replace(/\.json$/i, "");
      $("fileLabel").textContent = f.name;
      $("name").value = $("name").value || srcName;
      $("fileInfo").textContent =
        `${data.mControlDataList.length} buttons, ${(data.mJoystickDataList || []).length} joystick(s), version ${data.version ?? "?"}`;
      $("convert").disabled = false;
    } catch (err) {
      src = null; $("convert").disabled = true; $("fileInfo").textContent = "";
      showError(err.message);
    }
  });

  $("convert").addEventListener("click", () => {
    clearError();
    const num = (id) => parseFloat($(id).value);
    const o = { W: num("w"), H: num("h"), D: num("density"), scale: num("scale"), name: $("name").value.trim() };
    if (![o.W, o.H, o.D, o.scale].every((v) => Number.isFinite(v) && v > 0)) {
      showError("Screen width, height, density and scale must be positive numbers.");
      return;
    }
    try {
      const r = convert(src, o);
      out = r.layout;
      $("summary").textContent =
        `${r.stats.buttons} buttons, ${r.stats.joysticks} joystick(s), ${r.stats.styles} styles. ` +
        `Max position error: ${r.stats.worst.toFixed(2)}px.`;
      const ul = $("warnings");
      ul.replaceChildren(...r.warnings.map((w) => { const li = document.createElement("li"); li.textContent = w; return li; }));
      $("result").hidden = false;
    } catch (err) {
      showError("Conversion failed: " + err.message);
    }
  });

  $("download").addEventListener("click", () => {
    if (!out) return;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const base = ($("name").value.trim() || srcName).replace(/[^\w.-]+/g, "_");
    a.href = URL.createObjectURL(blob);
    a.download = base + "_zl2.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

if (typeof module !== "undefined") module.exports = { convert, evalMath };
