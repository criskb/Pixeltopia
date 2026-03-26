import { useEffect, useState } from 'react';
import { Download, FolderOpen, FilePlus2, Redo2, Save, Undo2, Sparkles, PenTool, Clapperboard, Bone, SunMedium } from 'lucide-react';
import {
  createWorkspacePolishPlan,
  loadAutosaveSnapshot,
  persistAutosaveSnapshot,
  useEditorDispatch,
  useEditorState
} from '../../state/EditorStateContext';
import ExportModal from '../export/ExportModal';

const modes = [
  { key: 'draw', label: 'Draw', icon: PenTool },
  { key: 'animate', label: 'Animate', icon: Clapperboard },
  { key: 'rigging', label: 'Rig', icon: Bone },
  { key: 'shader', label: 'Shader', icon: SunMedium }
];

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const state = useEditorState();
  const { canUndo, canRedo, workspaceMode, project } = state;
  const dispatch = useEditorDispatch();

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }
    const timer = window.setTimeout(() => setStatusMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const runActions = (actions) => {
    for (const action of actions) {
      dispatch(action);
    }
  };

  const handleReset = () => {
    const shouldReset = window.confirm('Start a new project? Unsaved canvas changes in this session will be discarded.');
    if (!shouldReset) {
      return;
    }
    dispatch({ type: 'project_reset' });
    setStatusMessage('Started a fresh project.');
  };

  const handleOpenAutosave = async () => {
    setLoadingSnapshot(true);
    try {
      const snapshot = await loadAutosaveSnapshot();
      if (!snapshot) {
        setStatusMessage('No autosave snapshot was found on this device.');
        return;
      }
      dispatch({ type: 'hydrate_from_snapshot', snapshot });
      const savedAt = snapshot.savedAt ? new Date(snapshot.savedAt).toLocaleString() : 'unknown time';
      setStatusMessage(`Restored autosave from ${savedAt}.`);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleSaveAutosave = async () => {
    setSavingSnapshot(true);
    try {
      await persistAutosaveSnapshot(state);
      setStatusMessage('Saved autosave snapshot for this project.');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handlePolish = () => {
    const plan = createWorkspacePolishPlan(state);
    runActions(plan.actions);
    setStatusMessage(plan.message);
  };

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
          <button onClick={handleReset}><FilePlus2 size={16} />New</button>
          <button onClick={handleSaveAutosave} disabled={savingSnapshot}><Save size={16} />{savingSnapshot ? 'Saving…' : 'Save'}</button>
          <button onClick={handleOpenAutosave} disabled={loadingSnapshot}><FolderOpen size={16} />{loadingSnapshot ? 'Loading…' : 'Open'}</button>
          <button onClick={handlePolish}><Sparkles size={16} />Polish</button>
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
        {statusMessage ? <div className="mode-meta" role="status">{statusMessage}</div> : null}
      </header>
      <ExportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
