import { useState } from 'react';
import { Download, FolderOpen, FilePlus2, Redo2, Undo2, Sparkles, PenTool, Clapperboard, Bone, SunMedium } from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';
import ExportModal from '../export/ExportModal';

const modes = [
  { key: 'draw', label: 'Draw', icon: PenTool },
  { key: 'animate', label: 'Animate', icon: Clapperboard },
  { key: 'rigging', label: 'Rig', icon: Bone },
  { key: 'shader', label: 'Shader', icon: SunMedium }
];

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const { canUndo, canRedo, workspaceMode, project } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Pixeltopia Studio</h1>
          <p className="subhead">Production-ready sprite pipeline · draw, animate, rig and light in one place</p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo}><Undo2 size={16} />Undo</button>
          <button onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo}><Redo2 size={16} />Redo</button>
          <button><FilePlus2 size={16} />New</button>
          <button><FolderOpen size={16} />Open</button>
          <button><Sparkles size={16} />Polish</button>
          <button className="primary" onClick={() => setOpen(true)}><Download size={16} />Export</button>
        </div>

        <div className="topbar-modes">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.key}
                className={workspaceMode === mode.key ? 'mode-chip active' : 'mode-chip'}
                onClick={() => dispatch({ type: 'set_workspace_mode', mode: mode.key })}
              >
                <Icon size={14} />
                {mode.label}
              </button>
            );
          })}
          <div className="mode-meta">{project.layers.length} layers · {project.frames.length} frames</div>
        </div>
      </header>
      <ExportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
