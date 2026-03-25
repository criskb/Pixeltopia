import { getPixel, inBounds, pixelsEqual, setPixel } from './pixelBuffer';

export function hexToRgba(hex) {
  const normalized = hex.replace('#', '');
  const chunks = normalized.length === 3
    ? normalized.split('').map((chunk) => chunk + chunk)
    : [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];

  return [
    Number.parseInt(chunks[0], 16),
    Number.parseInt(chunks[1], 16),
    Number.parseInt(chunks[2], 16),
    255
  ];
}

export function rgbaToHex(color) {
  return `#${color.slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function paintBrush(buffer, x, y, size, color) {
  const radius = Math.floor(size / 2);
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      setPixel(buffer, x + offsetX, y + offsetY, color);
    }
  }
}

export function floodFill(buffer, x, y, fillColor) {
  if (!inBounds(buffer, x, y)) {
    return;
  }

  const targetColor = getPixel(buffer, x, y);
  if (!targetColor || pixelsEqual(targetColor, fillColor)) {
    return;
  }

  const queue = [[x, y]];
  while (queue.length > 0) {
    const [currentX, currentY] = queue.pop();
    const pixel = getPixel(buffer, currentX, currentY);

    if (!pixel || !pixelsEqual(pixel, targetColor)) {
      continue;
    }

    setPixel(buffer, currentX, currentY, fillColor);
    queue.push([currentX + 1, currentY]);
    queue.push([currentX - 1, currentY]);
    queue.push([currentX, currentY + 1]);
    queue.push([currentX, currentY - 1]);
  }
}

export function applyTool(buffer, { tool, x, y, color, brushSize }) {
  const rgbaColor = hexToRgba(color);

  if (tool === 'pencil') {
    paintBrush(buffer, x, y, brushSize, rgbaColor);
    return { changed: true };
  }

  if (tool === 'eraser') {
    paintBrush(buffer, x, y, brushSize, [0, 0, 0, 0]);
    return { changed: true };
  }

  if (tool === 'fill') {
    floodFill(buffer, x, y, rgbaColor);
    return { changed: true };
  }

  if (tool === 'picker') {
    const pixel = getPixel(buffer, x, y) ?? [0, 0, 0, 0];
    return { changed: false, pickedColor: rgbaToHex(pixel) };
  }

  return { changed: false };
}
