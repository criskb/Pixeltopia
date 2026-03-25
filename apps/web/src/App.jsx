const tools = ['Pencil', 'Eraser', 'Fill', 'Line', 'Rect', 'Move'];
const panels = ['Layers', 'Palette', 'Brush', 'Inspector'];

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>PixelForge</h1>
        <div className="topbar-actions">
          <button>New</button>
          <button>Open</button>
          <button>Export</button>
        </div>
      </header>

      <aside className="tool-rail" aria-label="Tool rail">
        {tools.map((tool) => (
          <button key={tool} className="tool-btn" title={tool}>
            {tool.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </aside>

      <main className="workspace" aria-label="Workspace">
        <div className="canvas-header">
          <span>Canvas 64×64</span>
          <span>Zoom 400%</span>
        </div>
        <div className="canvas-backdrop">
          <div className="canvas" aria-hidden="true" />
        </div>
      </main>

      <aside className="inspector" aria-label="Inspector panels">
        {panels.map((panel) => (
          <section key={panel} className="panel">
            <h2>{panel}</h2>
            <p>Placeholder for {panel.toLowerCase()} controls.</p>
          </section>
        ))}
      </aside>

      <footer className="timeline" aria-label="Timeline">
        <div className="timeline-title">Timeline</div>
        <div className="timeline-frames">
          {Array.from({ length: 10 }, (_, index) => (
            <button key={index} className={index === 0 ? 'frame active' : 'frame'}>
              {index + 1}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
