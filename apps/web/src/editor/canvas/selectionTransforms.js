import { createPixelBuffer, getPixel, inBounds, setPixel } from './pixelBuffer';

export function createSelectionMask(width, height, fill = false) {
  return { width, height, data: new Uint8Array(width * height).fill(fill ? 1 : 0) };
}

function maskIndex(mask, x, y) {
  return y * mask.width + x;
}

export function isSelected(mask, x, y) {
  return Boolean(mask?.data?.[maskIndex(mask, x, y)]);
}

export function setSelected(mask, x, y, selected) {
  if (!mask || x < 0 || y < 0 || x >= mask.width || y >= mask.height) {
    return;
  }
  mask.data[maskIndex(mask, x, y)] = selected ? 1 : 0;
}

export function createRectSelectionMask(width, height, start, end) {
  const mask = createSelectionMask(width, height, false);
  const minX = Math.max(0, Math.min(start.x, end.x));
  const maxX = Math.min(width - 1, Math.max(start.x, end.x));
  const minY = Math.max(0, Math.min(start.y, end.y));
  const maxY = Math.min(height - 1, Math.max(start.y, end.y));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      setSelected(mask, x, y, true);
    }
  }

  return mask;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-7) + xi);
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function createLassoSelectionMask(width, height, points) {
  const mask = createSelectionMask(width, height, false);
  if (!points || points.length < 3) {
    return mask;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        setSelected(mask, x, y, true);
      }
    }
  }

  return mask;
}

export function getSelectionBounds(mask) {
  if (!mask) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (isSelected(mask, x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function selectionOrAll(buffer, selectionMask) {
  if (selectionMask) {
    return selectionMask;
  }
  return createSelectionMask(buffer.width, buffer.height, true);
}

function transformSelectedPixels(buffer, selectionMask, mapToSource) {
  const mask = selectionOrAll(buffer, selectionMask);
  const bounds = getSelectionBounds(mask);
  if (!bounds) {
    return buffer;
  }

  const snapshot = new Uint8ClampedArray(buffer.data);
  const out = createPixelBuffer(buffer.width, buffer.height);
  out.data.set(snapshot);

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (isSelected(mask, x, y)) {
        setPixel(out, x, y, [0, 0, 0, 0]);
      }
    }
  }

  const source = { width: buffer.width, height: buffer.height, data: snapshot };

  for (let dy = 0; dy < bounds.height; dy += 1) {
    for (let dx = 0; dx < bounds.width; dx += 1) {
      const destX = bounds.minX + dx;
      const destY = bounds.minY + dy;
      const src = mapToSource(dx, dy, bounds);
      const srcX = bounds.minX + src.x;
      const srcY = bounds.minY + src.y;
      if (!inBounds(source, srcX, srcY) || !isSelected(mask, srcX, srcY)) {
        continue;
      }
      const color = getPixel(source, srcX, srcY);
      if (color) {
        setPixel(out, destX, destY, color);
      }
    }
  }

  return out;
}

export function moveSelection(buffer, selectionMask, dx, dy, wrap = false) {
  const mask = selectionOrAll(buffer, selectionMask);
  const snapshot = new Uint8ClampedArray(buffer.data);
  const out = createPixelBuffer(buffer.width, buffer.height);
  out.data.set(snapshot);

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (isSelected(mask, x, y)) {
        setPixel(out, x, y, [0, 0, 0, 0]);
      }
    }
  }

  const source = { width: buffer.width, height: buffer.height, data: snapshot };
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!isSelected(mask, x, y)) {
        continue;
      }
      let nx = x + dx;
      let ny = y + dy;
      if (wrap) {
        nx = ((nx % buffer.width) + buffer.width) % buffer.width;
        ny = ((ny % buffer.height) + buffer.height) % buffer.height;
      }
      if (!inBounds(buffer, nx, ny)) {
        continue;
      }
      const color = getPixel(source, x, y);
      if (color) {
        setPixel(out, nx, ny, color);
      }
    }
  }

  return out;
}

export function scaleSelectionNearest(buffer, selectionMask, scaleX, scaleY) {
  return transformSelectedPixels(buffer, selectionMask, (dx, dy, bounds) => ({
    x: Math.max(0, Math.min(bounds.width - 1, Math.floor(dx / Math.max(scaleX, 1e-6)))),
    y: Math.max(0, Math.min(bounds.height - 1, Math.floor(dy / Math.max(scaleY, 1e-6))))
  }));
}

export function rotateSelection90(buffer, selectionMask, steps = 1) {
  const normalized = ((steps % 4) + 4) % 4;
  if (normalized === 0) {
    return buffer;
  }
  return transformSelectedPixels(buffer, selectionMask, (dx, dy, bounds) => {
    if (normalized === 1) {
      return { x: dy, y: bounds.height - 1 - dx };
    }
    if (normalized === 2) {
      return { x: bounds.width - 1 - dx, y: bounds.height - 1 - dy };
    }
    return { x: bounds.width - 1 - dy, y: dx };
  });
}

export function flipSelection(buffer, selectionMask, axis = 'horizontal') {
  return transformSelectedPixels(buffer, selectionMask, (dx, dy, bounds) => {
    if (axis === 'vertical') {
      return { x: dx, y: bounds.height - 1 - dy };
    }
    return { x: bounds.width - 1 - dx, y: dy };
  });
}

export function offsetBufferWrap(buffer, offsetX, offsetY) {
  const out = createPixelBuffer(buffer.width, buffer.height);
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const srcX = ((x - offsetX) % buffer.width + buffer.width) % buffer.width;
      const srcY = ((y - offsetY) % buffer.height + buffer.height) % buffer.height;
      const color = getPixel(buffer, srcX, srcY);
      if (color) {
        setPixel(out, x, y, color);
      }
    }
  }
  return out;
}
