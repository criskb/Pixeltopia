import { describe, expect, it } from 'vitest';
import { createPixelBuffer, getPixel, setPixel } from '../pixelBuffer';
import {
  createLassoSelectionMask,
  createRectSelectionMask,
  flipSelection,
  moveSelection,
  offsetBufferWrap,
  rotateSelection90,
  scaleSelectionNearest
} from '../selectionTransforms';
import { renderWrapPreviewBuffer } from '../renderPipeline';

function fillMarker(buffer) {
  setPixel(buffer, 1, 1, [255, 0, 0, 255]);
  setPixel(buffer, 2, 1, [0, 255, 0, 255]);
  setPixel(buffer, 1, 2, [0, 0, 255, 255]);
  setPixel(buffer, 2, 2, [255, 255, 0, 255]);
}

describe('selection workflows and transforms', () => {
  it('builds rectangular and lasso masks', () => {
    const rect = createRectSelectionMask(8, 8, { x: 1, y: 1 }, { x: 2, y: 2 });
    expect(rect.data.reduce((acc, v) => acc + v, 0)).toBe(4);

    const lasso = createLassoSelectionMask(8, 8, [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 }
    ]);
    expect(lasso.data.reduce((acc, v) => acc + v, 0)).toBeGreaterThanOrEqual(9);
  });

  it('preserves pixel integrity through move/rotate/flip', () => {
    const buffer = createPixelBuffer(6, 6);
    fillMarker(buffer);
    const mask = createRectSelectionMask(6, 6, { x: 1, y: 1 }, { x: 2, y: 2 });

    const moved = moveSelection(buffer, mask, 2, 1, false);
    expect(getPixel(moved, 3, 2)).toEqual([255, 0, 0, 255]);
    expect(getPixel(moved, 4, 3)).toEqual([255, 255, 0, 255]);

    const rotated = rotateSelection90(buffer, mask, 1);
    expect(getPixel(rotated, 1, 1)).toEqual([0, 0, 255, 255]);
    expect(getPixel(rotated, 2, 1)).toEqual([255, 0, 0, 255]);

    const flipped = flipSelection(buffer, mask, 'horizontal');
    expect(getPixel(flipped, 1, 1)).toEqual([0, 255, 0, 255]);
    expect(getPixel(flipped, 2, 1)).toEqual([255, 0, 0, 255]);
  });

  it('scales with nearest-neighbor mapping', () => {
    const buffer = createPixelBuffer(8, 8);
    fillMarker(buffer);
    const mask = createRectSelectionMask(8, 8, { x: 1, y: 1 }, { x: 4, y: 4 });

    const scaled = scaleSelectionNearest(buffer, mask, 0.5, 0.5);
    expect(getPixel(scaled, 1, 1)).toEqual([255, 0, 0, 255]);
  });

  it('supports wrap offset and 3x3 wrap preview tiling', () => {
    const buffer = createPixelBuffer(2, 2);
    setPixel(buffer, 0, 0, [255, 0, 0, 255]);
    setPixel(buffer, 1, 0, [0, 255, 0, 255]);
    setPixel(buffer, 0, 1, [0, 0, 255, 255]);
    setPixel(buffer, 1, 1, [255, 255, 0, 255]);

    const offset = offsetBufferWrap(buffer, 1, 0);
    expect(getPixel(offset, 0, 0)).toEqual([0, 255, 0, 255]);

    const preview = renderWrapPreviewBuffer(buffer, { x: 1, y: 0 });
    expect(preview.width).toBe(6);
    expect(preview.height).toBe(6);
    const topLeft = [preview.data[0], preview.data[1], preview.data[2], preview.data[3]];
    expect(topLeft).toEqual([0, 255, 0, 255]);
  });
});
