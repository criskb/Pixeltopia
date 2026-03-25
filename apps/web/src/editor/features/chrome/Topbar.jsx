import { useState } from 'react';
import { Download, FolderOpen, FilePlus2, Redo2, Undo2, Sparkles } from 'lucide-react';
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
          <h1>PixelForge Studio</h1>
          <p className="subhead">Retro sprite editor · animation timeline · palette workflow</p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo}><Undo2 size={16} />Undo</button>
          <button onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo}><Redo2 size={16} />Redo</button>
          <button><FilePlus2 size={16} />New</button>
          <button><FolderOpen size={16} />Open</button>
          <button><Sparkles size={16} />Polish</button>
          <button className="primary" onClick={() => setOpen(true)}><Download size={16} />Export</button>
        </div>
      </header>
      <ExportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
