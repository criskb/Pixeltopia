export function buildGrayscaleTextureData(mask, width, height, strength = 1) {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const value = Math.round(255 * Math.max(0, Math.min(1, ((mask?.[i] ?? 0) / 255) * strength)));
    const p = i * 4;
    out[p] = value;
    out[p + 1] = value;
    out[p + 2] = value;
    out[p + 3] = 255;
  }
  return out;
}

export function buildHeightTextureData(composite, heightMask, heightStrength = 0.35) {
  const { width, height } = composite;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const p = i * 4;
    const luminance = (
      0.2126 * composite.data[p]
      + 0.7152 * composite.data[p + 1]
      + 0.0722 * composite.data[p + 2]
    ) / 255;
    const fromMask = (heightMask?.[i] ?? 0) / 255;
    const combined = Math.max(0, Math.min(1, (luminance * 0.45) + (fromMask * heightStrength)));
    const value = Math.round(combined * 255);
    out[p] = value;
    out[p + 1] = value;
    out[p + 2] = value;
    out[p + 3] = 255;
  }
  return out;
}

export function buildNormalTextureData(heightData, width, height, strength = 0.8) {
  const out = new Uint8Array(width * height * 4);
  const getHeight = (x, y) => {
    const clampedX = Math.max(0, Math.min(width - 1, x));
    const clampedY = Math.max(0, Math.min(height - 1, y));
    return heightData[(clampedY * width + clampedX) * 4] / 255;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = getHeight(x - 1, y);
      const right = getHeight(x + 1, y);
      const up = getHeight(x, y - 1);
      const down = getHeight(x, y + 1);
      const dx = (right - left) * strength;
      const dy = (down - up) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.max(0.00001, Math.hypot(nx, ny, nz));
      const p = (y * width + x) * 4;
      out[p] = Math.round((((nx / len) * 0.5) + 0.5) * 255);
      out[p + 1] = Math.round((((ny / len) * 0.5) + 0.5) * 255);
      out[p + 2] = Math.round((((nz / len) * 0.5) + 0.5) * 255);
      out[p + 3] = 255;
    }
  }
  return out;
}

export function buildDepthTextureData(heightData) {
  const out = new Uint8Array(heightData.length);
  for (let i = 0; i < heightData.length; i += 4) {
    const depth = 255 - heightData[i];
    out[i] = depth;
    out[i + 1] = depth;
    out[i + 2] = depth;
    out[i + 3] = 255;
  }
  return out;
}
