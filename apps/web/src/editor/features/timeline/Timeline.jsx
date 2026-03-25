import { Clapperboard, Copy, Pause, Play, Plus, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

export default function Timeline() {
  const { frames, selectedFrameId, playback } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <footer className="timeline" aria-label="Timeline">
      <div className="timeline-header">
        <span className="timeline-title"><Clapperboard size={14} /> Walk Cycle</span>
        <span className="timeline-meta">{playback.fps} fps · {playback.loopMode}</span>
      </div>

      <div className="timeline-header controls">
        <button onClick={() => dispatch({ type: 'frame_create' })}><Plus size={14} />Frame</button>
        <button onClick={() => dispatch({ type: 'frame_duplicate' })}><Copy size={14} />Duplicate</button>
        <button onClick={() => dispatch({ type: 'frame_delete' })}><Trash2 size={14} />Delete</button>
        <button onClick={() => dispatch({ type: 'playback_toggle' })}>{playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}{playback.isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: -1 })}><SkipBack size={14} /></button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: 1 })}><SkipForward size={14} /></button>
        <label>
          FPS
          <input type="number" min="1" max="60" value={playback.fps} onChange={(e) => dispatch({ type: 'playback_set_fps', fps: Number(e.target.value) })} />
        </label>
        <select value={playback.loopMode} onChange={(e) => dispatch({ type: 'playback_set_loop_mode', loopMode: e.target.value })}>
          <option value="loop">Loop</option>
          <option value="once">Once</option>
        </select>
      </div>

      <div className="timeline-frames">
        {frames.map((frame, index) => (
          <button key={frame.id} className={frame.id === selectedFrameId ? 'frame active' : 'frame'} onClick={() => dispatch({ type: 'frame_select', frameId: frame.id })}>
            F{index + 1}
          </button>
        ))}
      </div>
    </footer>
  );
}
