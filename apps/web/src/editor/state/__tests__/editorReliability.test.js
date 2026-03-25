import { describe, expect, it, beforeEach } from 'vitest';
import { getSelectedCel } from '@pixelforge/domain';
import { createPixelBuffer, setPixel, getPixel } from '../../canvas/pixelBuffer';
import {
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
});
