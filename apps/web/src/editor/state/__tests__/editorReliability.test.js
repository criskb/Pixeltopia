import { describe, expect, it, beforeEach } from 'vitest';
import { getSelectedCel } from '@pixelforge/domain';
import { createPixelBuffer, setPixel, getPixel } from '../../canvas/pixelBuffer';
import {
  createWorkspacePolishPlan,
  editorReducer,
  initialState,
  loadAutosaveSnapshot,
  persistAutosaveSnapshot
} from '../EditorStateContext';

function freshState() {
  return editorReducer(initialState, { type: 'history_set_budget', budgetBytes: 16 * 1024 * 1024 });
}

describe('editor reliability layer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('supports multi-step undo/redo across pixel and timeline commands', () => {
    let state = freshState();

    const drawBuffer = createPixelBuffer(state.project.width, state.project.height);
    setPixel(drawBuffer, 2, 2, [255, 0, 0, 255]);

    state = editorReducer(state, { type: 'update_pixels', pixelBuffer: drawBuffer });
    state = editorReducer(state, { type: 'frame_create' });
    state = editorReducer(state, { type: 'frame_duplicate' });

    expect(state.history.undoStack).toHaveLength(3);
    expect(state.project.frames).toHaveLength(initialState.project.frames.length + 2);

    state = editorReducer(state, { type: 'undo' });
    expect(state.project.frames).toHaveLength(initialState.project.frames.length + 1);

    state = editorReducer(state, { type: 'undo' });
    expect(state.project.frames).toHaveLength(initialState.project.frames.length);

    state = editorReducer(state, { type: 'undo' });
    const selectedCelAfterUndo = getSelectedCel(state.project);
    expect(getPixel(selectedCelAfterUndo.pixelBuffer, 2, 2)).toEqual([0, 0, 0, 0]);

    state = editorReducer(state, { type: 'redo' });
    state = editorReducer(state, { type: 'redo' });
    state = editorReducer(state, { type: 'redo' });

    const selectedCelAfterRedo = getSelectedCel(state.project);
    expect(getPixel(selectedCelAfterRedo.pixelBuffer, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(state.project.frames).toHaveLength(initialState.project.frames.length + 2);
  });

  it('persists and restores autosave snapshots', async () => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });

    let state = freshState();
    const drawBuffer = createPixelBuffer(state.project.width, state.project.height);
    setPixel(drawBuffer, 4, 5, [12, 34, 56, 255]);
    state = editorReducer(state, { type: 'update_pixels', pixelBuffer: drawBuffer });

    await persistAutosaveSnapshot(state);
    const snapshot = await loadAutosaveSnapshot();

    expect(snapshot).toBeTruthy();
    const restored = editorReducer(state, { type: 'hydrate_from_snapshot', snapshot });
    const restoredCel = getSelectedCel(restored.project);
    expect(getPixel(restoredCel.pixelBuffer, 4, 5)).toEqual([12, 34, 56, 255]);
  });

  it('resets editor state while preserving custom undo budget', () => {
    let state = freshState();
    state = editorReducer(state, { type: 'history_set_budget', budgetBytes: 3 * 1024 * 1024 });

    const drawBuffer = createPixelBuffer(state.project.width, state.project.height);
    setPixel(drawBuffer, 1, 1, [10, 20, 30, 255]);
    state = editorReducer(state, { type: 'update_pixels', pixelBuffer: drawBuffer });

    const reset = editorReducer(state, { type: 'project_reset' });
    const resetCel = getSelectedCel(reset.project);

    expect(reset.history.budgetBytes).toBe(3 * 1024 * 1024);
    expect(reset.history.undoStack).toHaveLength(0);
    expect(getPixel(resetCel.pixelBuffer, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  it('builds mode-aware polish plans', () => {
    const drawPlan = createWorkspacePolishPlan({
      ...initialState,
      workspaceMode: 'draw',
      wrapPreviewEnabled: false,
      zoomLevel: 8
    });
    expect(drawPlan.actions).toEqual([
      { type: 'wrap_preview_toggle' },
      { type: 'set_zoom', zoom: 12 }
    ]);

    const animatePlan = createWorkspacePolishPlan({
      ...initialState,
      workspaceMode: 'animate',
      project: {
        ...initialState.project,
        onionSkin: { ...initialState.project.onionSkin, enabled: false },
        playback: { ...initialState.project.playback, fps: 10 }
      }
    });
    expect(animatePlan.actions).toEqual([
      { type: 'onion_toggle' },
      { type: 'playback_set_fps', fps: 12 }
    ]);
  });

  it('supports shader material value painting and auto height generation', () => {
    let state = freshState();
    const drawBuffer = createPixelBuffer(state.project.width, state.project.height);
    setPixel(drawBuffer, 3, 3, [200, 180, 160, 255]);
    state = editorReducer(state, { type: 'update_pixels', pixelBuffer: drawBuffer });
    state = editorReducer(state, { type: 'material_set_tool', tool: 'metalness' });
    state = editorReducer(state, { type: 'material_paint', x: 3, y: 3, radius: 0, value: 0.4 });
    const pixelIndex = (3 * state.project.width) + 3;
    expect(state.material.metalnessMask[pixelIndex]).toBe(Math.round(255 * 0.4));

    state = editorReducer(state, { type: 'material_generate_height_from_sprite', gain: 1 });
    expect(state.material.heightMask.some((value) => value > 0)).toBe(true);

    state = editorReducer(state, { type: 'material_generate_roughness_from_sprite', gain: 1, invert: true });
    state = editorReducer(state, { type: 'material_generate_metalness_from_sprite', gain: 1, invert: false });
    expect(state.material.roughnessMask.some((value) => value > 0)).toBe(true);
    expect(state.material.metalnessMask.some((value) => value > 0)).toBe(true);

    state = editorReducer(state, { type: 'material_apply_preset', preset: 'brushed_metal' });
    expect(state.material.metalnessStrength).toBeGreaterThan(0.8);

    const importedMask = new Uint8Array(state.project.width * state.project.height);
    importedMask[pixelIndex] = 222;
    state = editorReducer(state, { type: 'material_set_mask', channel: 'roughnessMask', mask: importedMask });
    expect(state.material.roughnessMask[pixelIndex]).toBe(222);

    state = editorReducer(state, { type: 'material_adjust_mask', channel: 'roughnessMask', operation: 'invert' });
    expect(state.material.roughnessMask[pixelIndex]).toBe(33);
  });

  it('resizes project document dimensions and preserves painted pixels', () => {
    let state = freshState();
    const drawBuffer = createPixelBuffer(state.project.width, state.project.height);
    setPixel(drawBuffer, 0, 0, [255, 0, 255, 255]);
    state = editorReducer(state, { type: 'update_pixels', pixelBuffer: drawBuffer });

    state = editorReducer(state, { type: 'project_resize', width: 32, height: 32 });
    expect(state.project.width).toBe(32);
    expect(state.project.height).toBe(32);
    const resizedCel = getSelectedCel(state.project);
    expect(getPixel(resizedCel.pixelBuffer, 0, 0)).toEqual([255, 0, 255, 255]);
  });
});
