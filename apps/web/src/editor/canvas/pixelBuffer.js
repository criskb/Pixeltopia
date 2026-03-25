export function createPixelBuffer(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const index = i * 4;
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }

  return { width, height, data };
}

export function inBounds(buffer, x, y) {
  return x >= 0 && y >= 0 && x < buffer.width && y < buffer.height;
}

export function pixelOffset(buffer, x, y) {
  return (y * buffer.width + x) * 4;
}

export function getPixel(buffer, x, y) {
  if (!inBounds(buffer, x, y)) {
    return null;
  }

  const offset = pixelOffset(buffer, x, y);
  return [
    buffer.data[offset],
    buffer.data[offset + 1],
    buffer.data[offset + 2],
    buffer.data[offset + 3]
  ];
}

export function setPixel(buffer, x, y, color) {
  if (!inBounds(buffer, x, y)) {
    return;
  }

  const offset = pixelOffset(buffer, x, y);
  buffer.data[offset] = color[0];
  buffer.data[offset + 1] = color[1];
  buffer.data[offset + 2] = color[2];
  buffer.data[offset + 3] = color[3];
}

export function cloneBuffer(buffer) {
  return {
    width: buffer.width,
    height: buffer.height,
    data: new Uint8ClampedArray(buffer.data)
  };
}

export function pixelsEqual(a, b) {
  return a?.length === 4 && b?.length === 4 && a.every((value, index) => value === b[index]);
}
