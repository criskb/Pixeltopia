import { useMemo, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / delta) + 2);
    else h = 60 * (((rn - gn) / delta) + 4);
  }

  return {
    h: (h + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r1, g1, b1] = [0, 0, 0];

  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / delta) + 2);
    else h = 60 * (((rn - gn) / delta) + 4);
  }
  return { h: (h + 360) % 360, s: Number.isFinite(s) ? s : 0, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r1, g1, b1] = [0, 0, 0];
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

export default function ColorControls({ color, onChange }) {
  const [mode, setMode] = useState('wheel');
  const [recentColors, setRecentColors] = useState([]);
  const rgb = useMemo(() => hexToRgb(color), [color]);
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb]);
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);

  const pushRecentColor = (value) => {
    setRecentColors((prev) => {
      const deduped = [value, ...prev.filter((item) => item.toLowerCase() !== value.toLowerCase())];
      return deduped.slice(0, 8);
    });
  };

  const applyColor = (nextColor, commit = false) => {
    onChange(nextColor);
    if (commit) {
      pushRecentColor(nextColor);
    }
  };

  const commitHsv = (nextH, nextS, nextV) => {
    const next = hsvToRgb(clamp(nextH, 0, 360), clamp(nextS, 0, 1), clamp(nextV, 0, 1));
    onChange(rgbToHex(next.r, next.g, next.b));
  };

  const onWheelPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const hue = (angle + 360) % 360;
    commitHsv(hue, hsv.s, hsv.v);
  };

  const onSvPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    commitHsv(hsv.h, x, 1 - y);
  };

  const harmony = useMemo(() => {
    const offsets = [0, 30, -30, 180, 120, -120];
    return offsets.map((offset) => {
      const rgbValue = hsvToRgb((hsv.h + offset + 360) % 360, hsv.s, hsv.v);
      return rgbToHex(rgbValue.r, rgbValue.g, rgbValue.b);
    });
  }, [hsv]);

  return (
    <div className="color-controls">
      <label className="control-row">
        <span>Color Mode</span>
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="wheel">Wheel + SV</option>
          <option value="rgb">RGB Sliders</option>
          <option value="hsv">HSV Sliders</option>
          <option value="hsl">HSL Sliders</option>
        </select>
      </label>

      <div className="color-primary-row">
        <input type="color" value={color} onChange={(event) => applyColor(event.target.value, true)} />
        <input
          className="hex-input"
          value={color}
          onChange={(event) => applyColor(event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`)}
          onBlur={(event) => applyColor(event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`, true)}
        />
      </div>

      {mode === 'wheel' && (
        <div className="wheel-layout">
          <div
            className="hue-wheel"
            onPointerDown={onWheelPointer}
            onPointerMove={(event) => event.buttons === 1 && onWheelPointer(event)}
            onPointerUp={() => pushRecentColor(color)}
          >
            <div className="wheel-indicator" style={{ transform: `rotate(${hsv.h}deg) translateX(54px)` }} />
          </div>
          <div
            className="sv-box"
            style={{ '--hue': `${hsv.h}` }}
            onPointerDown={onSvPointer}
            onPointerMove={(event) => event.buttons === 1 && onSvPointer(event)}
            onPointerUp={() => pushRecentColor(color)}
          >
            <div className="sv-indicator" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
          </div>
        </div>
      )}

      {mode === 'rgb' && (
        <>
          <label className="control-row"><span>R</span><input type="range" min="0" max="255" value={rgb.r} onChange={(event) => applyColor(rgbToHex(Number(event.target.value), rgb.g, rgb.b))} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>G</span><input type="range" min="0" max="255" value={rgb.g} onChange={(event) => applyColor(rgbToHex(rgb.r, Number(event.target.value), rgb.b))} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>B</span><input type="range" min="0" max="255" value={rgb.b} onChange={(event) => applyColor(rgbToHex(rgb.r, rgb.g, Number(event.target.value)))} onPointerUp={() => pushRecentColor(color)} /></label>
        </>
      )}

      {mode === 'hsv' && (
        <>
          <label className="control-row"><span>H</span><input type="range" min="0" max="360" value={hsv.h} onChange={(event) => commitHsv(Number(event.target.value), hsv.s, hsv.v)} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>S</span><input type="range" min="0" max="100" value={Math.round(hsv.s * 100)} onChange={(event) => commitHsv(hsv.h, Number(event.target.value) / 100, hsv.v)} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>V</span><input type="range" min="0" max="100" value={Math.round(hsv.v * 100)} onChange={(event) => commitHsv(hsv.h, hsv.s, Number(event.target.value) / 100)} onPointerUp={() => pushRecentColor(color)} /></label>
        </>
      )}

      {mode === 'hsl' && (
        <>
          <label className="control-row"><span>H</span><input type="range" min="0" max="360" value={hsl.h} onChange={(event) => {
            const next = hslToRgb(Number(event.target.value), hsl.s, hsl.l);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>S</span><input type="range" min="0" max="100" value={Math.round(hsl.s * 100)} onChange={(event) => {
            const next = hslToRgb(hsl.h, Number(event.target.value) / 100, hsl.l);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /></label>
          <label className="control-row"><span>L</span><input type="range" min="0" max="100" value={Math.round(hsl.l * 100)} onChange={(event) => {
            const next = hslToRgb(hsl.h, hsl.s, Number(event.target.value) / 100);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /></label>
        </>
      )}

      <div className="mini-swatches">
        {harmony.map((value) => (
          <button key={`h-${value}`} className="mini-swatch" style={{ background: value }} onClick={() => applyColor(value, true)} title={`Harmony ${value}`} />
        ))}
      </div>
      <div className="mini-swatches">
        {recentColors.map((value) => (
          <button key={`r-${value}`} className="mini-swatch" style={{ background: value }} onClick={() => applyColor(value, true)} title={`Recent ${value}`} />
        ))}
      </div>
    </div>
  );
}
