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

const EditorStateContext = createContext(null);
const EditorDispatchContext = createContext(null);

const initialProject = createProject({
  width: 64,
  height: 64,
  layerNames: ['FX', 'Line Art', 'Base Colors', 'Background'],
  frameCount: 12,
  createPixelBuffer
});

const initialState = {
  project: initialProject,
  currentColor: '#7C5CFF',
  brushSize: 1,
  activeTool: 'pencil',
  zoomLevel: 8,
  cursor: { x: 0, y: 0 }
};

function editorReducer(state, action) {
  switch (action.type) {
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
    case 'update_pixels':
      return { ...state, project: updateCelPixelBuffer(state.project, { pixelBuffer: action.pixelBuffer }) };
    case 'frame_create':
      return { ...state, project: createFrameAfter(state.project) };
    case 'frame_duplicate':
      return { ...state, project: duplicateFrame(state.project) };
    case 'frame_delete':
      return { ...state, project: deleteFrame(state.project) };
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
    default:
      return state;
  }
}

export function EditorProvider({ children }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  useEffect(() => {
    if (!state.project.playback.isPlaying) {
      return undefined;
    }

    const ms = 1000 / Math.max(1, state.project.playback.fps);
    const timer = setInterval(() => dispatch({ type: 'playback_advance', step: 1 }), ms);
    return () => clearInterval(timer);
  }, [state.project.playback.fps, state.project.playback.isPlaying]);

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
    project: state.project
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
