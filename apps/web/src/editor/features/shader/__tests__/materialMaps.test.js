import { describe, expect, it } from 'vitest';
import {
  buildDepthTextureData,
  buildGrayscaleTextureData,
  buildHeightTextureData,
  buildNormalTextureData
} from '../materialMaps';

describe('material map generation', () => {
  it('builds grayscale channel data from mask + strength', () => {
    const data = buildGrayscaleTextureData(new Uint8Array([255, 128, 0, 64]), 2, 2, 0.5);
    expect(Array.from(data.slice(0, 4))).toEqual([128, 128, 128, 255]);
    expect(Array.from(data.slice(4, 8))).toEqual([64, 64, 64, 255]);
  });

  it('builds height, normal, and depth maps with stable dimensions', () => {
    const composite = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        255, 255, 255, 255,
        80, 80, 80, 255,
        20, 20, 20, 255,
        0, 0, 0, 0
      ])
    };
    const mask = new Uint8Array([255, 128, 64, 0]);
    const height = buildHeightTextureData(composite, mask, 0.4);
    const normal = buildNormalTextureData(height, 2, 2, 1);
    const depth = buildDepthTextureData(height);

    expect(height.length).toBe(16);
    expect(normal.length).toBe(16);
    expect(depth.length).toBe(16);
    expect(depth[0]).toBe(255 - height[0]);
    expect(normal[3]).toBe(255);
  });
});
