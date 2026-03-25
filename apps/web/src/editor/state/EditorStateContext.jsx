import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  advancePlayhead,
  createFrameAfter,
  createProject,
  deleteFrame,
  duplicateFrame,
  getSelectedCel,
  selectFrame,
  selectLayer,
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

const initialProject = createProject({
  width: 64,
  height: 64,
  layerNames: ['FX', 'Line Art', 'Base Colors', 'Background'],
  frameCount: 12,
  createPixelBuffer
});

export const initialState = {
  project: initialProject,
  currentColor: '#7C5CFF',
  brushSize: 1,
  activeTool: 'pencil',
  zoomLevel: 8,
  cursor: { x: 0, y: 0 },
  selectionMask: null,
  selectionType: null,
  wrapPreviewEnabled: false,
  wrapOffset: { x: 0, y: 0 },
  history: {
    undoStack: [],
    redoStack: [],
    bytesUsed: 0,
    budgetBytes: DEFAULT_HISTORY_BUDGET_BYTES
  }
};

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
      wrapOffset: state.wrapOffset
    }
  };
}

function fromAutosaveSnapshot(snapshot) {
  return {
    ...initialState,
    ...snapshot.ui,
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

export function editorReducer(state, action) {
  switch (action.type) {
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
      return buildCommandResult(state, runMutation(state, action), action.type);
    default:
      return state;
  }
}

export function EditorProvider({ children }) {
  const [state, dispatch] = useReducer(editorReducer, {
    ...initialState,
    history: {
      ...initialState.history,
      budgetBytes: getHistoryBudget()
    }
  });

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

    const ms = 1000 / Math.max(1, state.project.playback.fps);
    const timer = setInterval(() => dispatch({ type: 'playback_advance', step: 1 }), ms);
    return () => clearInterval(timer);
  }, [state.project.playback.fps, state.project.playback.isPlaying]);

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
