import { describe, expect, it } from 'vitest';
import { createProject, selectFrame, toggleLayerVisibility } from '@pixelforge/domain';
import { setPixel } from '../pixelBuffer';
import { compositeProjectFrame, renderCanvasBuffer } from '../renderPipeline';
import { createPixelBuffer } from '../pixelBuffer';

function px(buffer) {
  return [buffer.data[0], buffer.data[1], buffer.data[2], buffer.data[3]];
}

describe('render pipeline', () => {
  it('composites layers in array order', () => {
    const project = createProject({ width: 1, height: 1, frameCount: 1, createPixelBuffer });
    const frame = project.frames[0];
    const [bottom, top] = project.layers;

    setPixel(frame.cels[bottom.id].pixelBuffer, 0, 0, [255, 0, 0, 255]);
    setPixel(frame.cels[top.id].pixelBuffer, 0, 0, [0, 0, 255, 255]);

    const output = compositeProjectFrame(project, frame.id);
    expect(px(output)).toEqual([0, 0, 255, 255]);
  });

  it('supports onion skin previous/next visibility', () => {
    let project = createProject({ width: 1, height: 1, frameCount: 3, layerNames: ['Layer'], createPixelBuffer });
    const layerId = project.layers[0].id;

    setPixel(project.frames[0].cels[layerId].pixelBuffer, 0, 0, [255, 0, 0, 255]);
    setPixel(project.frames[1].cels[layerId].pixelBuffer, 0, 0, [0, 255, 0, 160]);
    setPixel(project.frames[2].cels[layerId].pixelBuffer, 0, 0, [0, 0, 255, 255]);

    project = selectFrame(project, project.frames[1].id);
    project = { ...project, onionSkin: { ...project.onionSkin, enabled: true, previous: 1, next: 1, opacity: 0.5 } };

    const output = renderCanvasBuffer(project);
    expect(output.data[1]).toBeGreaterThan(120);
    expect(output.data[2]).toBeGreaterThan(0);
    expect(output.data[0]).toBeGreaterThan(0);
  });

  it('omits hidden layers from composite', () => {
    let project = createProject({ width: 1, height: 1, frameCount: 1, layerNames: ['A', 'B'], createPixelBuffer });
    const frame = project.frames[0];
    const [layerA, layerB] = project.layers;

    setPixel(frame.cels[layerA.id].pixelBuffer, 0, 0, [255, 0, 0, 255]);
    setPixel(frame.cels[layerB.id].pixelBuffer, 0, 0, [0, 255, 0, 255]);

    project = toggleLayerVisibility(project, layerB.id);
    const output = compositeProjectFrame(project, frame.id);
    expect(px(output)).toEqual([255, 0, 0, 255]);
  });

  it('supports point light mode using light position', () => {
    const project = createProject({ width: 3, height: 3, frameCount: 1, layerNames: ['Layer'], createPixelBuffer });
    const layerId = project.layers[0].id;
    const frame = project.frames[0];

    setPixel(frame.cels[layerId].pixelBuffer, 1, 1, [120, 120, 120, 255]);
    setPixel(frame.cels[layerId].pixelBuffer, 0, 1, [120, 120, 120, 255]);

    const litNearCenter = renderCanvasBuffer(project, {
      enabled: true,
      mode: 'point',
      position: { x: 1, y: 1 },
      intensity: 1,
      ambient: 0.1,
      color: '#ffffff'
    });

    const litFarAway = renderCanvasBuffer(project, {
      enabled: true,
      mode: 'point',
      position: { x: 2, y: 2 },
      intensity: 1,
      ambient: 0.1,
      color: '#ffffff'
    });

    const centerNear = litNearCenter.data[(1 * litNearCenter.width + 1) * 4];
    const centerFar = litFarAway.data[(1 * litFarAway.width + 1) * 4];
    expect(centerNear).not.toBe(centerFar);
  });

  it('applies HDRI tint samples when provided', () => {
    const project = createProject({ width: 3, height: 3, frameCount: 1, layerNames: ['Layer'], createPixelBuffer });
    const layerId = project.layers[0].id;
    const frame = project.frames[0];
    setPixel(frame.cels[layerId].pixelBuffer, 1, 1, [80, 80, 80, 255]);

    const lit = renderCanvasBuffer(project, {
      enabled: true,
      mode: 'global',
      direction: 20,
      intensity: 1,
      ambient: 0.1,
      color: '#000000',
      hdriStrength: 1,
      hdriSamples: [[255, 0, 0], [0, 0, 255]]
    });

    const pixel = (1 * lit.width + 1) * 4;
    expect(lit.data[pixel]).not.toBe(lit.data[pixel + 2]);
  });
});
