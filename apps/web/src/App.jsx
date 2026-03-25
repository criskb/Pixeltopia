import CanvasViewport from './editor/canvas/CanvasViewport';
import { EditorProvider, useEditorDispatch, useEditorState } from './editor/state/EditorStateContext';

const tools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B' },
  { key: 'eraser', label: 'Eraser', shortcut: 'E' },
  { key: 'fill', label: 'Fill', shortcut: 'G' },
  { key: 'picker', label: 'Picker', shortcut: 'I' }
];

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];

function ToolRail() {
  const { activeTool } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <aside className="tool-rail" aria-label="Tool rail">
      {tools.map((tool) => (
        <button
          key={tool.key}
          className={tool.key === activeTool ? 'tool-btn active' : 'tool-btn'}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => dispatch({ type: 'set_active_tool', tool: tool.key })}
        >
          <span className="tool-name">{tool.label.slice(0, 2).toUpperCase()}</span>
          <span className="shortcut">{tool.shortcut}</span>
        </button>
      ))}
    </aside>
  );
}

function Inspector() {
  const { currentColor, brushSize, zoomLevel, layers, selectedLayerId, onionSkin } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <aside className="inspector" aria-label="Inspector panels">
      <section className="panel">
        <h2>Palette</h2>
        <div className="swatch-grid">
          {swatches.map((color) => (
            <button
              key={color}
              className={currentColor === color ? 'swatch selected' : 'swatch'}
              title={color}
              aria-label={`Color ${color}`}
              style={{ background: color }}
              onClick={() => dispatch({ type: 'set_color', color })}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Layers</h2>
        <ul className="layer-list">
          {layers.map((layer) => (
            <li key={layer.id} className={layer.id === selectedLayerId ? 'layer-row selected' : 'layer-row'}>
              <button onClick={() => dispatch({ type: 'layer_toggle_visibility', layerId: layer.id })}>{layer.visible ? '👁' : '🚫'}</button>
              <button onClick={() => dispatch({ type: 'layer_toggle_lock', layerId: layer.id })}>{layer.locked ? '🔒' : '🔓'}</button>
              <button onClick={() => dispatch({ type: 'layer_select', layerId: layer.id })}>{layer.name}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Brush</h2>
        <label className="control-row" htmlFor="brushSize">
          <span>Size</span>
          <input
            id="brushSize"
            type="range"
            min="1"
            max="8"
            value={brushSize}
            onChange={(event) => dispatch({ type: 'set_brush_size', size: Number(event.target.value) })}
          />
        </label>
        <div className="control-row">
          <span>Zoom</span>
          <strong>{zoomLevel * 100}%</strong>
        </div>
      </section>

      <section className="panel">
        <h2>Onion Skin</h2>
        <button onClick={() => dispatch({ type: 'onion_toggle' })}>{onionSkin.enabled ? 'Disable' : 'Enable'}</button>
      </section>
    </aside>
  );
}

function Timeline() {
  const { frames, selectedFrameId, playback } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <footer className="timeline" aria-label="Timeline">
      <div className="timeline-header">
        <span className="timeline-title">Walk Cycle</span>
        <span className="timeline-meta">{playback.fps} fps · {playback.loopMode}</span>
      </div>

      <div className="timeline-header">
        <button onClick={() => dispatch({ type: 'frame_create' })}>+ Frame</button>
        <button onClick={() => dispatch({ type: 'frame_duplicate' })}>Duplicate</button>
        <button onClick={() => dispatch({ type: 'frame_delete' })}>Delete</button>
        <button onClick={() => dispatch({ type: 'playback_toggle' })}>{playback.isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: -1 })}>{'<'}</button>
        <button onClick={() => dispatch({ type: 'playback_advance', step: 1 })}>{'>'}</button>
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
            {index + 1}
          </button>
        ))}
      </div>
    </footer>
  );
}

function Workspace() {
  const { activeTool, currentColor, cursor, zoomLevel, width, height } = useEditorState();

  return (
    <>
      <ToolRail />

      <main className="workspace" aria-label="Workspace">
        <div className="canvas-header">
          <span>sprite_idle.png · {width}×{height}</span>
          <span>Zoom {zoomLevel * 100}% · Grid On</span>
        </div>
        <div className="canvas-backdrop">
          <CanvasViewport />
        </div>
        <div className="statusbar">
          <span>Tool: {activeTool}</span>
          <span>Color: {currentColor}</span>
          <span>Cursor: {cursor.x}, {cursor.y}</span>
        </div>
      </main>

      <Inspector />
      <Timeline />
    </>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <h1>PixelForge</h1>
            <p className="subhead">Sprite Editor Prototype</p>
          </div>
          <div className="topbar-actions">
            <button>New</button>
            <button>Open</button>
            <button className="primary">Export</button>
          </div>
        </header>

        <Workspace />
      </div>
    </EditorProvider>
  );
}
