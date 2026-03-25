import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];

export default function Inspector() {
  const { currentColor, brushSize, zoomLevel, layers, selectedLayerId, onionSkin, wrapPreviewEnabled } = useEditorState();
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

      <section className="panel">
        <h2>Wrap Preview</h2>
        <button onClick={() => dispatch({ type: 'wrap_preview_toggle' })}>{wrapPreviewEnabled ? 'Disable 3x3' : 'Enable 3x3'}</button>
      </section>
    </aside>
  );
}
