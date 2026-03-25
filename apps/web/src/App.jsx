import CanvasViewport from './editor/canvas/CanvasViewport';
import { EditorProvider, useEditorDispatch, useEditorState } from './editor/state/EditorStateContext';

const tools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B' },
  { key: 'eraser', label: 'Eraser', shortcut: 'E' },
  { key: 'fill', label: 'Fill', shortcut: 'G' },
  { key: 'picker', label: 'Picker', shortcut: 'I' }
];

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];

const layers = [
  { id: 'fx', name: 'FX', visible: true },
  { id: 'line', name: 'Line Art', visible: true },
  { id: 'base', name: 'Base Colors', visible: true },
  { id: 'bg', name: 'Background', visible: false }
];

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
  const { currentColor, brushSize, zoomLevel } = useEditorState();
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
          {layers.map((layer, index) => (
            <li key={layer.id} className={index === 1 ? 'layer-row selected' : 'layer-row'}>
              <span>{layer.visible ? '👁' : '🚫'}</span>
              <span>{layer.name}</span>
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
    </aside>
  );
}

function Timeline() {
  return (
    <footer className="timeline" aria-label="Timeline">
      <div className="timeline-header">
        <span className="timeline-title">Walk Cycle</span>
        <span className="timeline-meta">12 fps · loop</span>
      </div>
      <div className="timeline-frames">
        {Array.from({ length: 12 }, (_, index) => (
          <button key={index} className={index === 3 ? 'frame active' : 'frame'}>
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
