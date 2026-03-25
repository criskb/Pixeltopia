import { describe, expect, it } from 'vitest';
import { createPixelBuffer, getPixel, setPixel } from '../pixelBuffer';
import { applyTool } from '../tools';

describe('raster tool smoke tests', () => {
  it('pencil writes a pixel color', () => {
    const buffer = createPixelBuffer(8, 8);

    applyTool(buffer, { tool: 'pencil', x: 2, y: 2, color: '#FF00AA', brushSize: 1 });

    expect(getPixel(buffer, 2, 2)).toEqual([255, 0, 170, 255]);
  });

  it('eraser clears pixel alpha', () => {
    const buffer = createPixelBuffer(8, 8);
    setPixel(buffer, 3, 3, [20, 20, 20, 255]);

    applyTool(buffer, { tool: 'eraser', x: 3, y: 3, color: '#000000', brushSize: 1 });

    expect(getPixel(buffer, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  it('picker returns current pixel color as hex', () => {
    const buffer = createPixelBuffer(8, 8);
    setPixel(buffer, 1, 1, [124, 92, 255, 255]);

    const result = applyTool(buffer, { tool: 'picker', x: 1, y: 1, color: '#000000', brushSize: 1 });

    expect(result.pickedColor).toBe('#7C5CFF');
  });

  it('fill floods contiguous region and preserves boundaries', () => {
    const buffer = createPixelBuffer(4, 4);
    setPixel(buffer, 1, 0, [255, 255, 255, 255]);
    setPixel(buffer, 1, 1, [255, 255, 255, 255]);
    setPixel(buffer, 1, 2, [255, 255, 255, 255]);
    setPixel(buffer, 1, 3, [255, 255, 255, 255]);

    applyTool(buffer, { tool: 'fill', x: 0, y: 0, color: '#00C2FF', brushSize: 1 });

    expect(getPixel(buffer, 0, 0)).toEqual([0, 194, 255, 255]);
    expect(getPixel(buffer, 0, 3)).toEqual([0, 194, 255, 255]);
    expect(getPixel(buffer, 2, 0)).toEqual([0, 0, 0, 0]);
    expect(getPixel(buffer, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});
