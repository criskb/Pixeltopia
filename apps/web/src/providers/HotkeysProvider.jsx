import { useEffect, useRef } from 'react';
import {
  createWorkspacePolishPlan,
  persistAutosaveSnapshot,
  useEditorDispatch,
  useEditorState
} from '../editor/state/EditorStateContext';

export default function HotkeysProvider({ children }) {
  const state = useEditorState();
  const stateRef = useRef(state);
  const dispatch = useEditorDispatch();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();
      const withMeta = event.metaKey || event.ctrlKey;

      if (!withMeta && key === 'm') dispatch({ type: 'set_active_tool', tool: 'select-rect' });
      if (!withMeta && key === 'l') dispatch({ type: 'set_active_tool', tool: 'select-lasso' });
      if (!withMeta && key === 'b') dispatch({ type: 'set_active_tool', tool: 'pencil' });
      if (!withMeta && key === 'e') dispatch({ type: 'set_active_tool', tool: 'eraser' });
      if (!withMeta && key === 'g') dispatch({ type: 'set_active_tool', tool: 'fill' });
      if (!withMeta && key === 'i') dispatch({ type: 'set_active_tool', tool: 'picker' });
      if (key === 'escape') dispatch({ type: 'clear_selection' });
      if (key === 'w') dispatch({ type: 'wrap_preview_toggle' });

      if (withMeta && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: 'undo' });
      }
      if (withMeta && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        dispatch({ type: 'redo' });
      }

      if (withMeta && key === 'arrowleft') dispatch({ type: 'transform_pixels', transform: 'move', dx: -1, dy: 0 });
      if (withMeta && key === 'arrowright') dispatch({ type: 'transform_pixels', transform: 'move', dx: 1, dy: 0 });
      if (withMeta && key === 'arrowup') dispatch({ type: 'transform_pixels', transform: 'move', dx: 0, dy: -1 });
      if (withMeta && key === 'arrowdown') dispatch({ type: 'transform_pixels', transform: 'move', dx: 0, dy: 1 });
      if (withMeta && key === 'r') dispatch({ type: 'transform_pixels', transform: 'rotate', steps: event.shiftKey ? -1 : 1 });
      if (withMeta && key === 'h') dispatch({ type: 'transform_pixels', transform: 'flip', axis: 'horizontal' });
      if (withMeta && key === 'v') dispatch({ type: 'transform_pixels', transform: 'flip', axis: 'vertical' });
      if (withMeta && key === '=') dispatch({ type: 'transform_pixels', transform: 'scale', scaleX: 2, scaleY: 2 });
      if (withMeta && key === '-') dispatch({ type: 'transform_pixels', transform: 'scale', scaleX: 0.5, scaleY: 0.5 });
      if (withMeta && key === 's') {
        event.preventDefault();
        persistAutosaveSnapshot(stateRef.current);
      }
      if (withMeta && event.shiftKey && key === 'p') {
        event.preventDefault();
        const plan = createWorkspacePolishPlan(stateRef.current);
        for (const action of plan.actions) {
          dispatch(action);
        }
      }

      if (event.altKey && key === 'arrowleft') dispatch({ type: 'transform_pixels', transform: 'offset_wrap', dx: -1, dy: 0 });
      if (event.altKey && key === 'arrowright') dispatch({ type: 'transform_pixels', transform: 'offset_wrap', dx: 1, dy: 0 });
      if (event.altKey && key === 'arrowup') dispatch({ type: 'transform_pixels', transform: 'offset_wrap', dx: 0, dy: -1 });
      if (event.altKey && key === 'arrowdown') dispatch({ type: 'transform_pixels', transform: 'offset_wrap', dx: 0, dy: 1 });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state]);

  return children;
}
