import { useState } from 'react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';
import ExportModal from '../export/ExportModal';

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const { canUndo, canRedo } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>PixelForge</h1>
          <p className="subhead">Sprite Editor Prototype</p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo}>Undo</button>
          <button onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo}>Redo</button>
          <button>New</button>
          <button>Open</button>
          <button className="primary" onClick={() => setOpen(true)}>Export</button>
        </div>
      </header>
      <ExportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
