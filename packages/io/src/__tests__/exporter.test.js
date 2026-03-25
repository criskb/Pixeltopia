import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createProject, updateCelPixelBuffer } from '@pixelforge/domain';
import { serializeProjectExport } from '../exporter.js';
import { EXPORT_FORMAT, SPRITESHEET_LAYOUT } from '../settings.js';

function createPixelBuffer(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = fill[0];
    data[offset + 1] = fill[1];
    data[offset + 2] = fill[2];
    data[offset + 3] = fill[3];
  }
  return { width, height, data };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function fixtureProject() {
  let project = createProject({
    width: 2,
    height: 2,
    layerNames: ['Base'],
    frameCount: 2,
    createPixelBuffer
  });

  const layerId = project.layers[0].id;
  const frameA = project.frames[0].id;
  const frameB = project.frames[1].id;

  project = updateCelPixelBuffer(project, {
    frameId: frameA,
    layerId,
    pixelBuffer: {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 0, 0, 0,
        0, 255, 0, 255,
        0, 0, 255, 255
      ])
    }
  });

  project = updateCelPixelBuffer(project, {
    frameId: frameB,
    layerId,
    pixelBuffer: {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        255, 255, 0, 255,
        0, 255, 255, 255,
        0, 0, 0, 0,
        255, 0, 255, 255
      ])
    }
  });

  return project;
}

describe('serializeProjectExport', () => {
  it('serializes deterministic single-frame png bytes', () => {
    const result = serializeProjectExport(fixtureProject(), {
      format: EXPORT_FORMAT.SINGLE_FRAME_PNG,
      frameSource: 'selected',
      projectName: 'hero',
      filenameTemplate: '{project}-{format}-{frameIndex}'
    });

    expect(result.fileName).toBe('hero-png-1.png');
    expect(sha256(result.bytes)).toBe('f15fb2a054435756bd797081e74e04d211108b67e51e5ba18e18a58e0d47d6bc');
  });

  it('serializes deterministic multi-frame spritesheet bytes', () => {
    const result = serializeProjectExport(fixtureProject(), {
      format: EXPORT_FORMAT.SPRITESHEET_PNG,
      frameSource: 'all',
      layout: SPRITESHEET_LAYOUT.HORIZONTAL,
      padding: 1,
      projectName: 'hero',
      filenameTemplate: '{project}-{format}'
    });

    expect(result.width).toBe(5);
    expect(result.height).toBe(2);
    expect(sha256(result.bytes)).toBe('988b51f54ccbe356c2b451a9f61cea0a3fb41bfdeddbf5381dacce272e1f3dd3');
  });
});
