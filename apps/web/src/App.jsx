const tools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B' },
  { key: 'eraser', label: 'Eraser', shortcut: 'E' },
  { key: 'fill', label: 'Fill', shortcut: 'G' },
  { key: 'line', label: 'Line', shortcut: 'L' },
  { key: 'rect', label: 'Rect', shortcut: 'R' },
  { key: 'move', label: 'Move', shortcut: 'V' }
];

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];

const layers = [
  { id: 'fx', name: 'FX', visible: true },
  { id: 'line', name: 'Line Art', visible: true },
  { id: 'base', name: 'Base Colors', visible: true },
  { id: 'bg', name: 'Background', visible: false }
];

function ToolRail() {
  return (
    <aside className="tool-rail" aria-label="Tool rail">
      {tools.map((tool, index) => (
        <button key={tool.key} className={index === 0 ? 'tool-btn active' : 'tool-btn'} title={`${tool.label} (${tool.shortcut})`}>
          <span className="tool-name">{tool.label.slice(0, 2).toUpperCase()}</span>
          <span className="shortcut">{tool.shortcut}</span>
        </button>
      ))}
    </aside>
  );
}

function Inspector() {
  return (
    <aside className="inspector" aria-label="Inspector panels">
      <section className="panel">
        <h2>Palette</h2>
        <div className="swatch-grid">
          {swatches.map((color) => (
            <button key={color} className="swatch" title={color} aria-label={`Color ${color}`} style={{ background: color }} />
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
        <div className="control-row">
          <span>Size</span>
          <strong>1 px</strong>
        </div>
        <div className="control-row">
          <span>Opacity</span>
          <strong>100%</strong>
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

export default function App() {
  return (
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

      <ToolRail />

      <main className="workspace" aria-label="Workspace">
        <div className="canvas-header">
          <span>sprite_idle.png · 64×64</span>
          <span>Zoom 400% · Grid On</span>
        </div>
        <div className="canvas-backdrop">
          <div className="canvas" role="img" aria-label="Pixel canvas checkerboard preview" />
        </div>
        <div className="statusbar">
          <span>Tool: Pencil</span>
          <span>RGBA: 124, 92, 255, 1.00</span>
          <span>Cursor: 26, 11</span>
        </div>
      </main>

      <Inspector />
      <Timeline />
    </div>
  );
}
