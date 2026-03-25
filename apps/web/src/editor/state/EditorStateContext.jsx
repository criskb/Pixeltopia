import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  addLayer,
  advancePlayhead,
  createFrameAfter,
  createProject,
  deleteFrame,
  duplicateFrame,
  getSelectedCel,
  removeLayer,
  selectFrame,
  selectLayer,
  setLayerBlendMode,
  setLayerOpacity,
  setFrameDuration,
  setOnionSkin,
  setPlayback,
  toggleLayerLock,
  toggleLayerVisibility,
  updateCelPixelBuffer
} from '@pixelforge/domain';
import { createPixelBuffer } from '../canvas/pixelBuffer';
import {
  createLassoSelectionMask,
  createRectSelectionMask,
  flipSelection,
  moveSelection,
  offsetBufferWrap,
  rotateSelection90,
  scaleSelectionNearest
} from '../canvas/selectionTransforms';

const EditorStateContext = createContext(null);
const EditorDispatchContext = createContext(null);

const AUTOSAVE_KEY = 'pixelforge.autosave.v1';
const AUTOSAVE_DB = 'pixelforge_editor';
const AUTOSAVE_STORE = 'snapshots';
const AUTOSAVE_INTERVAL_MS = 12_000;
const DEFAULT_HISTORY_BUDGET_BYTES = 8 * 1024 * 1024;

function createBone(name = 'Bone') {
  return {
    id: `bone_${Math.random().toString(36).slice(2, 9)}`,
    name,
    start: { x: 32, y: 32 },
    end: { x: 32, y: 16 },
    restStart: { x: 32, y: 32 },
    restEnd: { x: 32, y: 16 }
  };
}

function solveTwoBoneIK(bones, target) {
  if (bones.length < 2) {
    return bones;
  }

  const root = bones[0].start;
  const l1 = Math.hypot(bones[0].end.x - bones[0].start.x, bones[0].end.y - bones[0].start.y) || 1;
  const l2 = Math.hypot(bones[1].end.x - bones[1].start.x, bones[1].end.y - bones[1].start.y) || 1;
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = Math.min(Math.max(Math.hypot(dx, dy), 0.0001), l1 + l2 - 0.0001);

  const a = Math.acos(Math.min(1, Math.max(-1, ((l1 * l1) + (dist * dist) - (l2 * l2)) / (2 * l1 * dist))));
  const b = Math.atan2(dy, dx);
  const mid = {
    x: root.x + Math.cos(b - a) * l1,
    y: root.y + Math.sin(b - a) * l1
  };

  const next = [...bones];
  next[0] = { ...next[0], end: mid };
  next[1] = { ...next[1], start: mid, end: { x: target.x, y: target.y } };
  return next;
}



function createEmptyMask(width, height) {
  return new Uint8Array(width * height);
}

function paintMask(mask, width, height, x, y, radius = 1, value = 255) {
  const next = new Uint8Array(mask);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }
      next[py * width + px] = Math.max(next[py * width + px], value);
    }
  }
  return next;
}

function eraseMask(mask, width, height, x, y, radius = 1) {
  const next = new Uint8Array(mask);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }
      next[py * width + px] = 0;
    }
  }
  return next;
}

function distanceToSegment(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 0.0001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const projX = start.x + t * vx;
  const projY = start.y + t * vy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function createAutoSkinMask(width, height, bone, radius = 6) {
  const mask = createEmptyMask(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dist = distanceToSegment({ x, y }, bone.start, bone.end);
      if (dist <= radius) {
        const idx = y * width + x;
        const strength = Math.round(255 * (1 - dist / Math.max(1, radius)));
        mask[idx] = Math.max(mask[idx], strength);
      }
    }
  }
  return mask;
}

function createHeightMaskFromSelectedCel(project, gain = 1) {
  const selectedCel = getSelectedCel(project);
  const source = selectedCel?.pixelBuffer?.data;
  if (!source) {
    return createEmptyMask(project.width, project.height);
  }
  const mask = new Uint8Array(project.width * project.height);
  for (let i = 0; i < project.width * project.height; i += 1) {
    const px = i * 4;
    const luminance = (0.2126 * source[px] + 0.7152 * source[px + 1] + 0.0722 * source[px + 2]) / 255;
    const alpha = source[px + 3] / 255;
    mask[i] = Math.round(255 * Math.max(0, Math.min(1, luminance * alpha * gain)));
  }
  return mask;
}
const initialProject = createProject({
  width: 64,
  height: 64,
  layerNames: ['Layer 1'],
  frameCount: 12,
  createPixelBuffer
});

export const initialState = {
  project: initialProject,
  currentColor: '#7C5CFF',
  brushSize: 1,
  activeTool: 'pencil',
  workspaceMode: 'draw',
  zoomLevel: 8,
  cursor: { x: 0, y: 0 },
  selectionMask: null,
  selectionType: null,
  wrapPreviewEnabled: false,
  wrapOffset: { x: 0, y: 0 },
  rigging: {
    enabled: false,
    tool: 'draw',
    bones: [createBone('Root')],
    selectedBoneId: null,
    draftBone: null,
    weightBrushRadius: 2,
    autoSkinRadius: 7,
    weights: {},
    keyframes: {}
  },
  lighting: {
    enabled: false,
    mode: 'point',
    direction: 40,
    intensity: 0.7,
    ambient: 0.35,
    color: '#ffd38a',
    position: { x: Math.round(initialProject.width * 0.75), y: Math.round(initialProject.height * 0.25) },
    hdriStrength: 0.6,
    hdriRotation: 0,
    hdriSamples: null,
    hdriFormat: '',
    hdriName: ''
  },
  material: {
    tool: 'light',
    brushRadius: 1,
    emissiveMask: createEmptyMask(initialProject.width, initialProject.height),
    roughnessMask: createEmptyMask(initialProject.width, initialProject.height),
    metalnessMask: createEmptyMask(initialProject.width, initialProject.height),
    heightMask: createEmptyMask(initialProject.width, initialProject.height),
    emissiveStrength: 0.6,
    roughnessStrength: 0.6,
    metalnessStrength: 0.35,
    heightStrength: 0.35,
    normalStrength: 0.8,
    emissivePaintValue: 1,
    roughnessPaintValue: 0.7,
    metalnessPaintValue: 0.65,
    heightPaintValue: 0.5
  },
  history: {
    undoStack: [],
    redoStack: [],
    bytesUsed: 0,
    budgetBytes: DEFAULT_HISTORY_BUDGET_BYTES
  }
};

function createDefaultState(historyBudgetBytes = getHistoryBudget()) {
  return {
    ...initialState,
    history: {
      ...initialState.history,
      budgetBytes: historyBudgetBytes
    }
  };
}

function getHistoryBudget() {
  if (typeof window === 'undefined') {
    return DEFAULT_HISTORY_BUDGET_BYTES;
  }

  const fromGlobal = Number(window.__PIXELFORGE_UNDO_BUDGET__);
  if (Number.isFinite(fromGlobal) && fromGlobal > 0) {
    return fromGlobal;
  }

  const fromStorage = Number(window.localStorage?.getItem('pixelforge.undoBudgetBytes'));
  if (Number.isFinite(fromStorage) && fromStorage > 0) {
    return fromStorage;
  }

  return DEFAULT_HISTORY_BUDGET_BYTES;
}

function estimateHistoryEntryBytes(entry) {
  const beforeBytes = entry.beforeProject?.frames.reduce((size, frame) => (
    size + Object.values(frame.cels).reduce((celSize, cel) => celSize + (cel.pixelBuffer?.data?.byteLength ?? 0), 0)
  ), 0) ?? 0;
  const afterBytes = entry.afterProject?.frames.reduce((size, frame) => (
    size + Object.values(frame.cels).reduce((celSize, cel) => celSize + (cel.pixelBuffer?.data?.byteLength ?? 0), 0)
  ), 0) ?? 0;
  return beforeBytes + afterBytes + 256;
}

function trimUndoStack(undoStack, budgetBytes) {
  const trimmed = [...undoStack];
  let bytesUsed = trimmed.reduce((sum, entry) => sum + entry.bytes, 0);

  while (trimmed.length > 0 && bytesUsed > budgetBytes) {
    const removed = trimmed.shift();
    bytesUsed -= removed?.bytes ?? 0;
  }

  return { undoStack: trimmed, bytesUsed: Math.max(0, bytesUsed) };
}

function cloneMask(mask) {
  return mask instanceof Uint8Array ? new Uint8Array(mask) : mask;
}

function cloneProjectForHistory(project) {
  return {
    ...project,
    layers: project.layers.map((layer) => ({ ...layer })),
    frames: project.frames.map((frame) => ({
      ...frame,
      cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => [layerId, {
        ...cel,
        pixelBuffer: {
          width: cel.pixelBuffer.width,
          height: cel.pixelBuffer.height,
          data: new Uint8ClampedArray(cel.pixelBuffer.data)
        }
      }]))
    })),
    playback: { ...project.playback },
    onionSkin: { ...project.onionSkin }
  };
}

function snapshotFromState(state) {
  return {
    project: cloneProjectForHistory(state.project),
    wrapOffset: { ...state.wrapOffset },
    selectionMask: cloneMask(state.selectionMask),
    selectionType: state.selectionType
  };
}

function applySnapshot(state, snapshot) {
  return {
    ...state,
    project: snapshot.project,
    wrapOffset: snapshot.wrapOffset,
    selectionMask: snapshot.selectionMask,
    selectionType: snapshot.selectionType
  };
}

function buildCommandResult(prevState, nextState, label) {
  if (nextState === prevState) {
    return prevState;
  }

  const beforeSnapshot = snapshotFromState(prevState);
  const afterSnapshot = snapshotFromState(nextState);
  const entry = {
    label,
    beforeProject: beforeSnapshot.project,
    beforeWrapOffset: beforeSnapshot.wrapOffset,
    beforeSelectionMask: beforeSnapshot.selectionMask,
    beforeSelectionType: beforeSnapshot.selectionType,
    afterProject: afterSnapshot.project,
    afterWrapOffset: afterSnapshot.wrapOffset,
    afterSelectionMask: afterSnapshot.selectionMask,
    afterSelectionType: afterSnapshot.selectionType
  };
  entry.bytes = estimateHistoryEntryBytes(entry);

  const { undoStack, bytesUsed } = trimUndoStack([
    ...prevState.history.undoStack,
    entry
  ], prevState.history.budgetBytes);

  return {
    ...nextState,
    history: {
      ...prevState.history,
      undoStack,
      redoStack: [],
      bytesUsed
    }
  };
}

function applyTransform(pixelBuffer, action, selectionMask) {
  if (!pixelBuffer) {
    return null;
  }

  switch (action.transform) {
    case 'move':
      return moveSelection(pixelBuffer, selectionMask, action.dx ?? 0, action.dy ?? 0, Boolean(action.wrap));
    case 'scale':
      return scaleSelectionNearest(pixelBuffer, selectionMask, action.scaleX ?? 1, action.scaleY ?? 1);
    case 'rotate':
      return rotateSelection90(pixelBuffer, selectionMask, action.steps ?? 1);
    case 'flip':
      return flipSelection(pixelBuffer, selectionMask, action.axis ?? 'horizontal');
    case 'offset_wrap':
      return offsetBufferWrap(pixelBuffer, action.dx ?? 0, action.dy ?? 0);
    default:
      return null;
  }
}

function runMutation(state, action) {
  switch (action.type) {
    case 'transform_pixels': {
      const selectedCel = getSelectedCel(state.project);
      const transformed = applyTransform(selectedCel?.pixelBuffer, action, state.selectionMask);
      if (!transformed) {
        return state;
      }

      return {
        ...state,
        project: updateCelPixelBuffer(state.project, { pixelBuffer: transformed }),
        wrapOffset: action.transform === 'offset_wrap'
          ? { x: state.wrapOffset.x + (action.dx ?? 0), y: state.wrapOffset.y + (action.dy ?? 0) }
          : state.wrapOffset
      };
    }
    case 'update_pixels':
      return { ...state, project: updateCelPixelBuffer(state.project, { pixelBuffer: action.pixelBuffer }) };
    case 'frame_create':
      return { ...state, project: createFrameAfter(state.project) };
    case 'frame_duplicate':
      return { ...state, project: duplicateFrame(state.project) };
    case 'frame_delete':
      return { ...state, project: deleteFrame(state.project) };
    case 'frame_set_duration':
      return { ...state, project: setFrameDuration(state.project, action.frameId ?? state.project.selectedFrameId, action.duration) };
    case 'layer_create':
      return { ...state, project: addLayer(state.project, { createPixelBuffer, name: action.name }) };
    case 'layer_delete':
      return { ...state, project: removeLayer(state.project, action.layerId) };
    case 'layer_set_blend_mode':
      return { ...state, project: setLayerBlendMode(state.project, action.layerId, action.blendMode) };
    case 'layer_set_opacity':
      return { ...state, project: setLayerOpacity(state.project, action.layerId, action.opacity) };
    default:
      return state;
  }
}

function deserializePixelBuffer(pixelBuffer) {
  return {
    width: pixelBuffer.width,
    height: pixelBuffer.height,
    data: new Uint8ClampedArray(pixelBuffer.data)
  };
}

function serializeProject(project) {
  return {
    ...project,
    frames: project.frames.map((frame) => ({
      ...frame,
      cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => [layerId, {
        ...cel,
        pixelBuffer: {
          width: cel.pixelBuffer.width,
          height: cel.pixelBuffer.height,
          data: Array.from(cel.pixelBuffer.data)
        }
      }]))
    }))
  };
}

function deserializeProject(project) {
  return {
    ...project,
    frames: project.frames.map((frame) => ({
      ...frame,
      cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => [layerId, {
        ...cel,
        pixelBuffer: deserializePixelBuffer(cel.pixelBuffer)
      }]))
    }))
  };
}

function toAutosaveSnapshot(state) {
  return {
    savedAt: new Date().toISOString(),
    project: serializeProject(state.project),
    ui: {
      currentColor: state.currentColor,
      brushSize: state.brushSize,
      activeTool: state.activeTool,
      zoomLevel: state.zoomLevel,
      wrapPreviewEnabled: state.wrapPreviewEnabled,
      wrapOffset: state.wrapOffset,
      rigging: state.rigging,
      lighting: state.lighting,
      material: {
        ...state.material,
        emissiveMask: Array.from(state.material.emissiveMask),
        roughnessMask: Array.from(state.material.roughnessMask),
        metalnessMask: Array.from(state.material.metalnessMask),
        heightMask: Array.from(state.material.heightMask)
      }
    }
  };
}

function fromAutosaveSnapshot(snapshot) {
  return {
    ...initialState,
    ...snapshot.ui,
    material: snapshot.ui?.material ? {
      ...initialState.material,
      ...snapshot.ui.material,
      emissiveMask: new Uint8Array(snapshot.ui.material.emissiveMask ?? initialState.material.emissiveMask),
      roughnessMask: new Uint8Array(snapshot.ui.material.roughnessMask ?? initialState.material.roughnessMask),
      metalnessMask: new Uint8Array(snapshot.ui.material.metalnessMask ?? initialState.material.metalnessMask),
      heightMask: new Uint8Array(snapshot.ui.material.heightMask ?? initialState.material.heightMask)
    } : initialState.material,
    project: deserializeProject(snapshot.project),
    history: {
      ...initialState.history,
      budgetBytes: getHistoryBudget()
    }
  };
}

function loadFromLocalStorage() {
  try {
    const value = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function saveToLocalStorage(snapshot) {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota errors
  }
}

async function withAutosaveStore(mode, handler) {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }

  return new Promise((resolve) => {
    const openReq = window.indexedDB.open(AUTOSAVE_DB, 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
        db.createObjectStore(AUTOSAVE_STORE);
      }
    };
    openReq.onerror = () => resolve(null);
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(AUTOSAVE_STORE, mode);
      const store = tx.objectStore(AUTOSAVE_STORE);
      handler(store, resolve);
      tx.oncomplete = () => db.close();
      tx.onerror = () => resolve(null);
    };
  });
}

async function saveToIndexedDb(snapshot) {
  return withAutosaveStore('readwrite', (store, resolve) => {
    const req = store.put(snapshot, AUTOSAVE_KEY);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(null);
  });
}

async function loadFromIndexedDb() {
  return withAutosaveStore('readonly', (store, resolve) => {
    const req = store.get(AUTOSAVE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function loadAutosaveSnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  const indexed = await loadFromIndexedDb();
  return indexed ?? loadFromLocalStorage();
}

export async function persistAutosaveSnapshot(state) {
  if (typeof window === 'undefined') {
    return;
  }
  const snapshot = toAutosaveSnapshot(state);
  saveToLocalStorage(snapshot);
  await saveToIndexedDb(snapshot);
}

export function createWorkspacePolishPlan(state) {
  switch (state.workspaceMode) {
    case 'draw': {
      const actions = [];
      if (!state.wrapPreviewEnabled) {
        actions.push({ type: 'wrap_preview_toggle' });
      }
      if (state.zoomLevel < 12) {
        actions.push({ type: 'set_zoom', zoom: 12 });
      }
      return { actions, message: 'Draw polish applied: wrap preview on, zoom set for detail.' };
    }
    case 'animate': {
      const actions = [];
      if (!state.project.onionSkin.enabled) {
        actions.push({ type: 'onion_toggle' });
      }
      if (state.project.playback.fps < 12) {
        actions.push({ type: 'playback_set_fps', fps: 12 });
      }
      return { actions, message: 'Animate polish applied: onion skin on, fps floor set to 12.' };
    }
    case 'rigging': {
      const actions = [];
      if (!state.rigging.enabled) {
        actions.push({ type: 'rigging_toggle' });
      }
      actions.push({ type: 'rigging_set_tool', tool: 'move' });
      return { actions, message: 'Rig polish applied: rigging enabled and move tool armed.' };
    }
    default: {
      const actions = [];
      if (!state.lighting.enabled) {
        actions.push({ type: 'lighting_toggle' });
      }
      actions.push({ type: 'lighting_set', updates: { intensity: Math.max(state.lighting.intensity, 0.75) } });
      return { actions, message: 'Shader polish applied: lighting boosted for preview.' };
    }
  }
}

export function editorReducer(state, action) {
  switch (action.type) {
    case 'project_reset':
      return createDefaultState(state.history.budgetBytes);
    case 'hydrate_from_snapshot':
      return action.snapshot ? fromAutosaveSnapshot(action.snapshot) : state;
    case 'history_set_budget': {
      const budgetBytes = Math.max(1, Number(action.budgetBytes) || DEFAULT_HISTORY_BUDGET_BYTES);
      const trimmed = trimUndoStack(state.history.undoStack, budgetBytes);
      return {
        ...state,
        history: {
          ...state.history,
          budgetBytes,
          undoStack: trimmed.undoStack,
          bytesUsed: trimmed.bytesUsed
        }
      };
    }
    case 'undo': {
      const entry = state.history.undoStack[state.history.undoStack.length - 1];
      if (!entry) {
        return state;
      }

      const restored = {
        ...state,
        project: entry.beforeProject,
        wrapOffset: entry.beforeWrapOffset,
        selectionMask: entry.beforeSelectionMask,
        selectionType: entry.beforeSelectionType
      };
      const undoStack = state.history.undoStack.slice(0, -1);
      const redoStack = [...state.history.redoStack, entry];
      const bytesUsed = undoStack.reduce((sum, item) => sum + item.bytes, 0);
      return {
        ...restored,
        history: {
          ...state.history,
          undoStack,
          redoStack,
          bytesUsed
        }
      };
    }
    case 'redo': {
      const entry = state.history.redoStack[state.history.redoStack.length - 1];
      if (!entry) {
        return state;
      }

      const restored = {
        ...state,
        project: entry.afterProject,
        wrapOffset: entry.afterWrapOffset,
        selectionMask: entry.afterSelectionMask,
        selectionType: entry.afterSelectionType
      };
      const redoStack = state.history.redoStack.slice(0, -1);
      const { undoStack, bytesUsed } = trimUndoStack([...state.history.undoStack, entry], state.history.budgetBytes);

      return {
        ...restored,
        history: {
          ...state.history,
          undoStack,
          redoStack,
          bytesUsed
        }
      };
    }
    case 'set_active_tool':
      return { ...state, activeTool: action.tool };
    case 'set_workspace_mode':
      return { ...state, workspaceMode: action.mode };
    case 'set_color':
      return { ...state, currentColor: action.color };
    case 'set_zoom':
      return { ...state, zoomLevel: action.zoom };
    case 'set_cursor':
      return { ...state, cursor: action.cursor };
    case 'set_brush_size':
      return { ...state, brushSize: action.size };
    case 'set_selection':
      return { ...state, selectionMask: action.mask, selectionType: action.selectionType ?? state.selectionType };
    case 'clear_selection':
      return { ...state, selectionMask: null, selectionType: null };
    case 'selection_rect':
      return {
        ...state,
        selectionType: 'rect',
        selectionMask: createRectSelectionMask(state.project.width, state.project.height, action.start, action.end)
      };
    case 'selection_lasso':
      return {
        ...state,
        selectionType: 'lasso',
        selectionMask: createLassoSelectionMask(state.project.width, state.project.height, action.points)
      };
    case 'wrap_preview_toggle':
      return { ...state, wrapPreviewEnabled: !state.wrapPreviewEnabled };
    case 'wrap_offset_set':
      return { ...state, wrapOffset: action.offset };
    case 'rigging_toggle':
      return { ...state, rigging: { ...state.rigging, enabled: !state.rigging.enabled } };
    case 'rigging_set_tool':
      return { ...state, rigging: { ...state.rigging, tool: action.tool } };
    case 'rigging_set_weight_radius':
      return { ...state, rigging: { ...state.rigging, weightBrushRadius: Math.max(1, Math.min(16, action.radius ?? 2)) } };
    case 'rigging_set_auto_skin_radius':
      return { ...state, rigging: { ...state.rigging, autoSkinRadius: Math.max(1, Math.min(32, action.radius ?? 7)) } };
    case 'rigging_start_draw':
      return { ...state, rigging: { ...state.rigging, draftBone: { start: action.start, end: action.start } } };
    case 'rigging_update_draw':
      return state.rigging.draftBone ? { ...state, rigging: { ...state.rigging, draftBone: { ...state.rigging.draftBone, end: action.end } } } : state;
    case 'rigging_commit_draw': {
      if (!state.rigging.draftBone) {
        return state;
      }
      const selected = state.rigging.bones.find((bone) => bone.id === state.rigging.selectedBoneId);
      const start = action.connect && selected ? { ...selected.end } : state.rigging.draftBone.start;
      const end = state.rigging.draftBone.end;
      const bone = createBone(`Bone ${state.rigging.bones.length + 1}`);
      bone.start = start;
      bone.end = end;
      bone.restStart = { ...start };
      bone.restEnd = { ...end };
      return { ...state, rigging: { ...state.rigging, bones: [...state.rigging.bones, bone], selectedBoneId: bone.id, draftBone: null } };
    }
    case 'rigging_move_bone':
      return {
        ...state,
        rigging: {
          ...state.rigging,
          bones: state.rigging.bones.map((bone) => bone.id === action.boneId ? {
            ...bone,
            start: { x: Math.round(bone.start.x + action.dx), y: Math.round(bone.start.y + action.dy) },
            end: { x: Math.round(bone.end.x + action.dx), y: Math.round(bone.end.y + action.dy) }
          } : bone)
        }
      };
    case 'rigging_paint_weight': {
      const boneId = action.boneId ?? state.rigging.selectedBoneId;
      if (!boneId) {
        return state;
      }
      const currentMask = state.rigging.weights[boneId] ?? createEmptyMask(state.project.width, state.project.height);
      const nextMask = paintMask(currentMask, state.project.width, state.project.height, action.x, action.y, action.radius ?? 1);
      return { ...state, rigging: { ...state.rigging, weights: { ...state.rigging.weights, [boneId]: nextMask } } };
    }
    case 'rigging_keyframe_set': {
      const boneId = action.boneId ?? state.rigging.selectedBoneId;
      const bone = state.rigging.bones.find((item) => item.id === boneId);
      if (!bone) {
        return state;
      }
      const dx = Math.round(bone.end.x - bone.restEnd.x);
      const dy = Math.round(bone.end.y - bone.restEnd.y);
      const frameId = state.project.selectedFrameId;
      return {
        ...state,
        rigging: {
          ...state.rigging,
          keyframes: {
            ...state.rigging.keyframes,
            [frameId]: {
              ...(state.rigging.keyframes[frameId] ?? {}),
              [boneId]: { dx, dy }
            }
          }
        }
      };
    }
    case 'rigging_add_bone': {
      const bone = createBone(action.name || `Bone ${state.rigging.bones.length + 1}`);
      return { ...state, rigging: { ...state.rigging, bones: [...state.rigging.bones, bone], selectedBoneId: bone.id } };
    }
    case 'rigging_select_bone':
      return { ...state, rigging: { ...state.rigging, selectedBoneId: action.boneId } };
    case 'rigging_select_next_bone': {
      if (!state.rigging.bones.length) {
        return state;
      }
      const currentIndex = state.rigging.bones.findIndex((bone) => bone.id === state.rigging.selectedBoneId);
      const nextIndex = (currentIndex + 1 + state.rigging.bones.length) % state.rigging.bones.length;
      return { ...state, rigging: { ...state.rigging, selectedBoneId: state.rigging.bones[nextIndex].id } };
    }
    case 'rigging_auto_skin_selected': {
      const boneId = action.boneId ?? state.rigging.selectedBoneId;
      const bone = state.rigging.bones.find((item) => item.id === boneId);
      if (!bone) {
        return state;
      }
      const radius = Math.max(1, action.radius ?? 6);
      return {
        ...state,
        rigging: {
          ...state.rigging,
          weights: {
            ...state.rigging.weights,
            [bone.id]: createAutoSkinMask(state.project.width, state.project.height, bone, radius)
          }
        }
      };
    }
    case 'rigging_auto_skin_all': {
      const radius = Math.max(1, action.radius ?? 7);
      const weights = { ...state.rigging.weights };
      for (const bone of state.rigging.bones) {
        weights[bone.id] = createAutoSkinMask(state.project.width, state.project.height, bone, radius);
      }
      return { ...state, rigging: { ...state.rigging, weights } };
    }
    case 'rigging_clear_selected_weights': {
      const boneId = action.boneId ?? state.rigging.selectedBoneId;
      if (!boneId) {
        return state;
      }
      return {
        ...state,
        rigging: {
          ...state.rigging,
          weights: {
            ...state.rigging.weights,
            [boneId]: createEmptyMask(state.project.width, state.project.height)
          }
        }
      };
    }
    case 'rigging_delete_bone': {
      if (state.rigging.bones.length <= 1) {
        return state;
      }
      const bones = state.rigging.bones.filter((bone) => bone.id !== action.boneId);
      return { ...state, rigging: { ...state.rigging, bones, selectedBoneId: bones[0]?.id ?? null } };
    }
    case 'rigging_update_bone':
      return {
        ...state,
        rigging: {
          ...state.rigging,
          bones: state.rigging.bones.map((bone) => bone.id === action.boneId ? { ...bone, ...action.updates } : bone)
        }
      };
    case 'rigging_ik_drag':
      return { ...state, rigging: { ...state.rigging, bones: solveTwoBoneIK(state.rigging.bones, action.target) } };
    case 'lighting_toggle':
      return { ...state, lighting: { ...state.lighting, enabled: !state.lighting.enabled } };
    case 'lighting_set':
      return { ...state, lighting: { ...state.lighting, ...action.updates } };
    case 'material_set_tool':
      return { ...state, material: { ...state.material, tool: action.tool } };
    case 'material_set_brush_radius':
      return { ...state, material: { ...state.material, brushRadius: Math.max(1, Math.min(16, action.radius ?? 1)) } };
    case 'material_set_strength':
      return { ...state, material: { ...state.material, emissiveStrength: action.value } };
    case 'material_set_roughness_strength':
      return { ...state, material: { ...state.material, roughnessStrength: action.value } };
    case 'material_set_metalness_strength':
      return { ...state, material: { ...state.material, metalnessStrength: action.value } };
    case 'material_set_height_strength':
      return { ...state, material: { ...state.material, heightStrength: action.value } };
    case 'material_set_normal_strength':
      return { ...state, material: { ...state.material, normalStrength: action.value } };
    case 'material_set_paint_value':
      return { ...state, material: { ...state.material, [action.channel]: Math.max(0, Math.min(1, action.value ?? 0)) } };
    case 'material_generate_height_from_sprite':
      return {
        ...state,
        material: {
          ...state.material,
          heightMask: createHeightMaskFromSelectedCel(state.project, action.gain ?? 1)
        }
      };
    case 'material_clear_emissive':
      return { ...state, material: { ...state.material, emissiveMask: createEmptyMask(state.project.width, state.project.height) } };
    case 'material_clear_roughness':
      return { ...state, material: { ...state.material, roughnessMask: createEmptyMask(state.project.width, state.project.height) } };
    case 'material_clear_metalness':
      return { ...state, material: { ...state.material, metalnessMask: createEmptyMask(state.project.width, state.project.height) } };
    case 'material_clear_height':
      return { ...state, material: { ...state.material, heightMask: createEmptyMask(state.project.width, state.project.height) } };
    case 'material_paint': {
      const tool = state.material.tool;
      const target = tool === 'roughness'
        ? 'roughnessMask'
        : tool === 'metalness'
          ? 'metalnessMask'
          : tool === 'height'
            ? 'heightMask'
            : 'emissiveMask';
      const value = Math.round(255 * Math.max(0, Math.min(1, action.value ?? 1)));
      const mask = paintMask(state.material[target], state.project.width, state.project.height, action.x, action.y, action.radius ?? 1, value);
      return { ...state, material: { ...state.material, [target]: mask } };
    }
    case 'material_erase': {
      const tool = state.material.tool;
      const target = tool === 'roughness-erase'
        ? 'roughnessMask'
        : tool === 'metalness-erase'
          ? 'metalnessMask'
          : tool === 'height-erase'
            ? 'heightMask'
            : 'emissiveMask';
      const mask = eraseMask(state.material[target], state.project.width, state.project.height, action.x, action.y, action.radius ?? 1);
      return { ...state, material: { ...state.material, [target]: mask } };
    }
    case 'frame_select':
      return { ...state, project: selectFrame(state.project, action.frameId) };
    case 'layer_toggle_visibility':
      return { ...state, project: toggleLayerVisibility(state.project, action.layerId) };
    case 'layer_toggle_lock':
      return { ...state, project: toggleLayerLock(state.project, action.layerId) };
    case 'layer_select':
      return { ...state, project: selectLayer(state.project, action.layerId) };
    case 'playback_set_fps':
      return { ...state, project: setPlayback(state.project, { fps: action.fps }) };
    case 'playback_set_loop_mode':
      return { ...state, project: setPlayback(state.project, { loopMode: action.loopMode }) };
    case 'playback_toggle':
      return { ...state, project: setPlayback(state.project, { isPlaying: !state.project.playback.isPlaying }) };
    case 'playback_advance': {
      const nextProject = advancePlayhead(state.project, action.step ?? 1);
      return { ...state, project: selectFrame(nextProject, nextProject.playback.playheadFrameId) };
    }
    case 'onion_toggle':
      return { ...state, project: setOnionSkin(state.project, { enabled: !state.project.onionSkin.enabled }) };
    case 'update_pixels':
    case 'transform_pixels':
    case 'frame_create':
    case 'frame_duplicate':
    case 'frame_delete':
    case 'frame_set_duration':
    case 'layer_create':
    case 'layer_delete':
    case 'layer_set_blend_mode':
    case 'layer_set_opacity':
      return buildCommandResult(state, runMutation(state, action), action.type);
    default:
      return state;
  }
}

export function EditorProvider({ children }) {
  const [state, dispatch] = useReducer(editorReducer, createDefaultState());

  useEffect(() => {
    let cancelled = false;

    loadAutosaveSnapshot().then((snapshot) => {
      if (!snapshot || cancelled) {
        return;
      }

      const stamp = snapshot.savedAt ? new Date(snapshot.savedAt).toLocaleString() : 'unknown time';
      const shouldRecover = window.confirm(`Recover autosaved project from ${stamp}?`);
      if (shouldRecover) {
        dispatch({ type: 'hydrate_from_snapshot', snapshot });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.project.playback.isPlaying) {
      return undefined;
    }

    const frame = state.project.frames.find((item) => item.id === state.project.selectedFrameId);
    const frameDuration = Math.max(1, frame?.duration ?? 1);
    const ms = (1000 / Math.max(1, state.project.playback.fps)) * frameDuration;
    const timer = setInterval(() => dispatch({ type: 'playback_advance', step: 1 }), ms);
    return () => clearInterval(timer);
  }, [state.project.frames, state.project.selectedFrameId, state.project.playback.fps, state.project.playback.isPlaying]);

  useEffect(() => {
    const timer = setInterval(() => {
      persistAutosaveSnapshot(state);
    }, AUTOSAVE_INTERVAL_MS);

    const onPageHide = () => persistAutosaveSnapshot(state);

    let idleId = null;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => persistAutosaveSnapshot(state), { timeout: 4000 });
    }

    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(timer);
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [state]);

  const selectedCel = getSelectedCel(state.project);
  const value = useMemo(() => ({
    ...state,
    width: state.project.width,
    height: state.project.height,
    pixelBuffer: selectedCel?.pixelBuffer,
    layers: state.project.layers,
    frames: state.project.frames,
    selectedFrameId: state.project.selectedFrameId,
    selectedLayerId: state.project.selectedLayerId,
    playback: state.project.playback,
    onionSkin: state.project.onionSkin,
    project: state.project,
    selectionMask: state.selectionMask,
    selectionType: state.selectionType,
    wrapPreviewEnabled: state.wrapPreviewEnabled,
    wrapOffset: state.wrapOffset,
    canUndo: state.history.undoStack.length > 0,
    canRedo: state.history.redoStack.length > 0
  }), [state, selectedCel]);

  return (
    <EditorStateContext.Provider value={value}>
      <EditorDispatchContext.Provider value={dispatch}>{children}</EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  );
}

export function useEditorState() {
  const value = useContext(EditorStateContext);
  if (!value) {
    throw new Error('useEditorState must be used within EditorProvider');
  }

  return value;
}

export function useEditorDispatch() {
  const value = useContext(EditorDispatchContext);
  if (!value) {
    throw new Error('useEditorDispatch must be used within EditorProvider');
  }

  return value;
}
