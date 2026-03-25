import { createContext, useContext, useMemo, useReducer } from 'react';
import { cloneBuffer, createPixelBuffer } from '../canvas/pixelBuffer';

const EditorStateContext = createContext(null);
const EditorDispatchContext = createContext(null);

const initialState = {
  width: 64,
  height: 64,
  pixelBuffer: createPixelBuffer(64, 64),
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
      return { ...state, pixelBuffer: cloneBuffer(action.pixelBuffer) };
    default:
      return state;
  }
}

export function EditorProvider({ children }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const value = useMemo(() => state, [state]);
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
