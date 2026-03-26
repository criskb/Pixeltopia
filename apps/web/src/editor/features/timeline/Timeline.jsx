import { Clapperboard, Copy, Gauge, Layers, Pause, Play, Plus, SkipBack, SkipForward, Timer, Trash2 } from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

export default function Timeline() {
  const { frames, selectedFrameId, playback, onionSkin } = useEditorState();
  const dispatch = useEditorDispatch();
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];
  const selectedFrameIndex = Math.max(0, frames.findIndex((frame) => frame.id === selectedFrameId));
  const totalDurationTicks = frames.reduce((sum, frame) => sum + frame.duration, 0);
  const playheadPercent = frames.length <= 1 ? 0 : Math.round((selectedFrameIndex / (frames.length - 1)) * 100);

  const onScrub = (value) => {
    const index = Number(value);
    const frame = frames[index];
    if (!frame) {
      return;
    }
    dispatch({ type: 'frame_select', frameId: frame.id });
  };

  return (
    <footer className="timeline" aria-label="Timeline">
      <div className="timeline-header">
        <span className="timeline-title"><Clapperboard size={14} /> Walk Cycle</span>
        <span className="timeline-meta">{playback.fps} fps · {playback.loopMode} · {frames.length} frames · {totalDurationTicks} ticks</span>
      </div>

      <div className="timeline-header controls">
        <button onClick={() => dispatch({ type: 'onion_toggle' })}><Layers size={14} />{onionSkin.enabled ? 'Onion On' : 'Onion Off'}</button>
        <button onClick={() => dispatch({ type: 'frame_create' })}><Plus size={14} />Frame</button>
        <button onClick={() => dispatch({ type: 'frame_duplicate' })}><Copy size={14} />Duplicate</button>
        <button onClick={() => dispatch({ type: 'frame_delete' })}><Trash2 size={14} />Delete</button>
        <button onClick={() => dispatch({ type: 'playback_toggle' })}>{playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}{playback.isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => onScrub(0)}><SkipBack size={14} />Start</button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: -1 })}><SkipBack size={14} /></button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: 1 })}><SkipForward size={14} /></button>
        <button onClick={() => onScrub(frames.length - 1)}><SkipForward size={14} />End</button>
        <label>
          FPS
          <input type="number" min="1" max="60" value={playback.fps} onChange={(e) => dispatch({ type: 'playback_set_fps', fps: Number(e.target.value) })} />
        </label>
        <label>
          <Gauge size={13} /> Dur
          <input type="number" min="1" max="12" value={selectedFrame?.duration ?? 1} onChange={(e) => dispatch({ type: 'frame_set_duration', frameId: selectedFrameId, duration: Number(e.target.value) })} />
        </label>
        <select value={playback.loopMode} onChange={(e) => dispatch({ type: 'playback_set_loop_mode', loopMode: e.target.value })}>
          <option value="loop">Loop</option>
          <option value="once">Once</option>
        </select>
      </div>

      <div className="timeline-scrubber">
        <label htmlFor="timelineScrubber"><Timer size={12} /> Playhead</label>
        <input
          id="timelineScrubber"
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={selectedFrameIndex}
          onChange={(event) => onScrub(event.target.value)}
        />
        <span>F{selectedFrameIndex + 1} · {playheadPercent}%</span>
      </div>

      <div className="timeline-ruler" aria-hidden="true">
        {frames.map((frame, index) => (
          <span key={`${frame.id}-tick`} className={index === selectedFrameIndex ? 'tick active' : 'tick'} />
        ))}
      </div>

      <div className="timeline-frames">
        {frames.map((frame, index) => (
          <button key={frame.id} className={frame.id === selectedFrameId ? 'frame active' : 'frame'} onClick={() => dispatch({ type: 'frame_select', frameId: frame.id })}>
            <span>F{index + 1}</span>
            <small>{frame.duration}t · {Math.round((frame.duration / Math.max(1, totalDurationTicks)) * 100)}%</small>
          </button>
        ))}
      </div>
    </footer>
  );
}
