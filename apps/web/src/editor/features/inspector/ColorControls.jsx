import { useEffect, useMemo, useRef, useState } from 'react';

const COLOR_CONTROLS_STORAGE_KEY = 'pixeltopia:color-controls:v2';

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

function normalizeHex(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '').replace(/[^0-9a-f]/gi, '');
  if (!raw) return null;
  if (raw.length === 3) {
    return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`;
  }
  if (raw.length >= 6) {
    return `#${raw.slice(0, 6).toUpperCase()}`;
  }
  return null;
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
  const [favoriteColors, setFavoriteColors] = useState([]);
  const [hexDraft, setHexDraft] = useState(color);
  const [lastCommittedColor, setLastCommittedColor] = useState(color.toUpperCase());
  const lastCommittedRef = useRef('');
  const rgb = useMemo(() => hexToRgb(color), [color]);
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb]);
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);

  useEffect(() => {
    setHexDraft(color.toUpperCase());
  }, [color]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const saved = window.localStorage.getItem(COLOR_CONTROLS_STORAGE_KEY);
      if (!saved) {
        return;
      }
      const parsed = JSON.parse(saved);
      if (typeof parsed?.mode === 'string') {
        setMode(parsed.mode);
      }
      if (Array.isArray(parsed?.recentColors)) {
        const sanitized = parsed.recentColors
          .map((value) => normalizeHex(value))
          .filter(Boolean)
          .slice(0, 8);
        setRecentColors(sanitized);
      }
      if (Array.isArray(parsed?.favoriteColors)) {
        const favorites = parsed.favoriteColors
          .map((value) => normalizeHex(value))
          .filter(Boolean)
          .slice(0, 12);
        setFavoriteColors(favorites);
      }
    } catch {
      // Ignore invalid persisted values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(
        COLOR_CONTROLS_STORAGE_KEY,
        JSON.stringify({ mode, recentColors, favoriteColors })
      );
    } catch {
      // Ignore write failures (private mode, quota, etc).
    }
  }, [mode, recentColors, favoriteColors]);

  useEffect(() => {
    const normalized = normalizeHex(color);
    if (normalized) {
      setLastCommittedColor((prev) => (prev === normalized ? prev : normalized));
    }
  }, [color]);

  const pushRecentColor = (value) => {
    const normalized = normalizeHex(value);
    if (!normalized || normalized === lastCommittedRef.current) {
      return;
    }
    lastCommittedRef.current = normalized;
    setRecentColors((prev) => {
      const deduped = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())];
      return deduped.slice(0, 8);
    });
  };

  const applyColor = (nextColor, commit = false) => {
    const normalized = normalizeHex(nextColor);
    if (!normalized) {
      return;
    }
    onChange(normalized);
    if (commit) {
      setLastCommittedColor(normalized);
      pushRecentColor(normalized);
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
    const distance = Math.hypot(dx, dy);
    const outerRadius = rect.width * 0.5;
    const innerRadius = rect.width * 0.24;
    if (distance < innerRadius || distance > outerRadius) {
      return;
    }
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

  const isCurrentFavorite = favoriteColors.some((value) => value.toLowerCase() === color.toLowerCase());

  const toggleFavoriteColor = (value) => {
    const normalized = normalizeHex(value);
    if (!normalized) {
      return;
    }
    setFavoriteColors((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === normalized.toLowerCase());
      if (exists) {
        return prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
      }
      return [normalized, ...prev].slice(0, 12);
    });
  };

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
        <input type="color" value={color} onChange={(event) => applyColor(event.target.value, true)} aria-label="Color picker" />
        <input
          className="hex-input"
          value={hexDraft}
          onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
          onBlur={(event) => {
            const normalized = normalizeHex(event.target.value) ?? color;
            setHexDraft(normalized);
            applyColor(normalized, true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const normalized = normalizeHex(hexDraft) ?? color;
              setHexDraft(normalized);
              applyColor(normalized, true);
              event.currentTarget.blur();
            }
          }}
          aria-label="Hex color"
        />
        <button className="ghost-button" type="button" onClick={() => applyColor(lastCommittedColor, true)} title="Revert to last committed color">
          Revert
        </button>
        <button className="ghost-button" type="button" onClick={() => navigator.clipboard?.writeText(color.toUpperCase())} title="Copy current hex">
          Copy
        </button>
        <button className={`ghost-button ${isCurrentFavorite ? 'is-active' : ''}`} type="button" onClick={() => toggleFavoriteColor(color)} title="Toggle favorite color">
          {isCurrentFavorite ? '★ Saved' : '☆ Save'}
        </button>
      </div>

      <div className="commit-preview-row" aria-label="Color commit preview">
        <div className="commit-chip">
          <span>Current</span>
          <button type="button" className="commit-swatch" style={{ '--swatch': color }} onClick={() => applyColor(color, true)}>
            {color.toUpperCase()}
          </button>
        </div>
        <div className="commit-chip">
          <span>Last Set</span>
          <button type="button" className="commit-swatch commit-swatch-last" style={{ '--swatch': lastCommittedColor }} onClick={() => applyColor(lastCommittedColor, true)}>
            {lastCommittedColor}
          </button>
        </div>
      </div>

      {mode === 'wheel' && (
        <div className="wheel-layout">
          <div
            className="hue-wheel"
            onPointerDown={onWheelPointer}
            onPointerMove={(event) => event.buttons === 1 && onWheelPointer(event)}
            onPointerUp={() => pushRecentColor(color)}
          >
            <div className="wheel-indicator" style={{ transform: `rotate(${hsv.h}deg) translateX(var(--wheel-indicator-radius))` }} />
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
          <label className="control-row"><span>R</span><input type="range" min="0" max="255" value={rgb.r} onChange={(event) => applyColor(rgbToHex(Number(event.target.value), rgb.g, rgb.b))} onPointerUp={() => pushRecentColor(color)} /><strong>{rgb.r}</strong></label>
          <label className="control-row"><span>G</span><input type="range" min="0" max="255" value={rgb.g} onChange={(event) => applyColor(rgbToHex(rgb.r, Number(event.target.value), rgb.b))} onPointerUp={() => pushRecentColor(color)} /><strong>{rgb.g}</strong></label>
          <label className="control-row"><span>B</span><input type="range" min="0" max="255" value={rgb.b} onChange={(event) => applyColor(rgbToHex(rgb.r, rgb.g, Number(event.target.value)))} onPointerUp={() => pushRecentColor(color)} /><strong>{rgb.b}</strong></label>
        </>
      )}

      {mode === 'hsv' && (
        <>
          <label className="control-row"><span>H</span><input type="range" min="0" max="360" value={hsv.h} onChange={(event) => commitHsv(Number(event.target.value), hsv.s, hsv.v)} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsv.h)}°</strong></label>
          <label className="control-row"><span>S</span><input type="range" min="0" max="100" value={Math.round(hsv.s * 100)} onChange={(event) => commitHsv(hsv.h, Number(event.target.value) / 100, hsv.v)} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsv.s * 100)}%</strong></label>
          <label className="control-row"><span>V</span><input type="range" min="0" max="100" value={Math.round(hsv.v * 100)} onChange={(event) => commitHsv(hsv.h, hsv.s, Number(event.target.value) / 100)} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsv.v * 100)}%</strong></label>
        </>
      )}

      {mode === 'hsl' && (
        <>
          <label className="control-row"><span>H</span><input type="range" min="0" max="360" value={hsl.h} onChange={(event) => {
            const next = hslToRgb(Number(event.target.value), hsl.s, hsl.l);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsl.h)}°</strong></label>
          <label className="control-row"><span>S</span><input type="range" min="0" max="100" value={Math.round(hsl.s * 100)} onChange={(event) => {
            const next = hslToRgb(hsl.h, Number(event.target.value) / 100, hsl.l);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsl.s * 100)}%</strong></label>
          <label className="control-row"><span>L</span><input type="range" min="0" max="100" value={Math.round(hsl.l * 100)} onChange={(event) => {
            const next = hslToRgb(hsl.h, hsl.s, Number(event.target.value) / 100);
            onChange(rgbToHex(next.r, next.g, next.b));
          }} onPointerUp={() => pushRecentColor(color)} /><strong>{Math.round(hsl.l * 100)}%</strong></label>
        </>
      )}

      <div className="mini-swatches">
        <span className="swatch-section-title">Favorites</span>
        {favoriteColors.length === 0 && <span className="swatch-empty">Save favorites for quick reuse</span>}
        {favoriteColors.map((value) => (
          <button
            key={`f-${value}`}
            className="mini-swatch favorite-swatch"
            style={{ background: value }}
            onClick={() => applyColor(value, true)}
            onContextMenu={(event) => {
              event.preventDefault();
              toggleFavoriteColor(value);
            }}
            title={`Favorite ${value} (right-click to remove)`}
          />
        ))}
      </div>
      <div className="mini-swatches">
        <span className="swatch-section-title">Harmony</span>
        {harmony.map((value) => (
          <button key={`h-${value}`} className="mini-swatch" style={{ background: value }} onClick={() => applyColor(value, true)} title={`Harmony ${value}`} />
        ))}
      </div>
      <div className="mini-swatches">
        <span className="swatch-section-title">Recent</span>
        {recentColors.length > 0 && (
          <button className="mini-clear" type="button" onClick={() => setRecentColors([])}>
            Clear
          </button>
        )}
        {recentColors.length === 0 && <span className="swatch-empty">No committed colors yet</span>}
        {recentColors.map((value) => (
          <button key={`r-${value}`} className="mini-swatch" style={{ background: value }} onClick={() => applyColor(value, true)} title={`Recent ${value}`} />
        ))}
      </div>
    </div>
  );
}
