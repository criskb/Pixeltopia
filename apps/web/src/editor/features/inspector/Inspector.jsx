import { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Palette,
  Paintbrush,
  Repeat2,
  Layers3,
  Plus,
  Trash2,
  Bone,
  SunMedium,
  Sparkles
} from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];
const blendModes = ['normal', 'multiply', 'screen', 'add'];

export default function Inspector() {
  const { currentColor, brushSize, zoomLevel, layers, selectedLayerId, onionSkin, wrapPreviewEnabled, rigging, lighting } = useEditorState();
  const dispatch = useEditorDispatch();
  const [tab, setTab] = useState('paint');
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const selectedBone = useMemo(() => rigging.bones.find((bone) => bone.id === (rigging.selectedBoneId ?? rigging.bones[0]?.id)), [rigging]);

  return (
    <aside className="inspector" aria-label="Inspector panels">
      <section className="panel tab-panel">
        <button className={tab === 'paint' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('paint')}><Paintbrush size={14} />Paint</button>
        <button className={tab === 'rigging' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('rigging')}><Bone size={14} />Rigging</button>
        <button className={tab === 'lighting' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('lighting')}><SunMedium size={14} />Shader</button>
      </section>

      {tab === 'paint' && (
        <>
          <section className="panel">
            <h2><Palette size={14} /> Palette</h2>
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
            <h2><Layers3 size={14} /> Layers</h2>
            <div className="layer-actions">
              <button onClick={() => dispatch({ type: 'layer_create' })}><Plus size={14} />Add</button>
              <button onClick={() => dispatch({ type: 'layer_delete', layerId: selectedLayerId })} disabled={layers.length <= 1}><Trash2 size={14} />Remove</button>
            </div>
            <ul className="layer-list">
              {layers.map((layer) => (
                <li key={layer.id} className={layer.id === selectedLayerId ? 'layer-row selected' : 'layer-row'}>
                  <button onClick={() => dispatch({ type: 'layer_toggle_visibility', layerId: layer.id })}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button onClick={() => dispatch({ type: 'layer_toggle_lock', layerId: layer.id })}>{layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
                  <button onClick={() => dispatch({ type: 'layer_select', layerId: layer.id })}>{layer.name}</button>
                </li>
              ))}
            </ul>

            {selectedLayer && (
              <>
                <label className="control-row">
                  <span>Blend</span>
                  <select
                    value={selectedLayer.blendMode ?? 'normal'}
                    onChange={(event) => dispatch({ type: 'layer_set_blend_mode', layerId: selectedLayer.id, blendMode: event.target.value })}
                  >
                    {blendModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
                <label className="control-row" htmlFor="layerOpacity">
                  <span>Opacity</span>
                  <input
                    id="layerOpacity"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                    onChange={(event) => dispatch({ type: 'layer_set_opacity', layerId: selectedLayer.id, opacity: Number(event.target.value) / 100 })}
                  />
                </label>
              </>
            )}
          </section>

          <section className="panel">
            <h2><Repeat2 size={14} /> Preview Helpers</h2>
            <label className="control-row" htmlFor="brushSize">
              <span>Brush</span>
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
            <button onClick={() => dispatch({ type: 'onion_toggle' })}>{onionSkin.enabled ? 'Disable Onion Skin' : 'Enable Onion Skin'}</button>
            <button onClick={() => dispatch({ type: 'wrap_preview_toggle' })}>{wrapPreviewEnabled ? 'Disable 3x3 Wrap' : 'Enable 3x3 Wrap'}</button>
          </section>
        </>
      )}

      {tab === 'rigging' && (
        <section className="panel">
          <h2><Bone size={14} /> Bone Rig</h2>
          <p className="subhead">Create simple bones and preview them over the sprite.</p>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'rigging_toggle' })}>{rigging.enabled ? 'Disable Rig Overlay' : 'Enable Rig Overlay'}</button>
            <button onClick={() => dispatch({ type: 'rigging_add_bone' })}><Plus size={14} />Bone</button>
          </div>
          <ul className="layer-list">
            {rigging.bones.map((bone) => (
              <li key={bone.id} className={bone.id === selectedBone?.id ? 'layer-row selected' : 'layer-row'}>
                <button onClick={() => dispatch({ type: 'rigging_select_bone', boneId: bone.id })}>{bone.name}</button>
                <button onClick={() => dispatch({ type: 'rigging_delete_bone', boneId: bone.id })} disabled={rigging.bones.length <= 1}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>

          {selectedBone && (
            <>
              <label className="control-row"><span>Start X</span><input type="number" value={selectedBone.start.x} onChange={(event) => dispatch({ type: 'rigging_update_bone', boneId: selectedBone.id, updates: { start: { ...selectedBone.start, x: Number(event.target.value) || 0 } } })} /></label>
              <label className="control-row"><span>Start Y</span><input type="number" value={selectedBone.start.y} onChange={(event) => dispatch({ type: 'rigging_update_bone', boneId: selectedBone.id, updates: { start: { ...selectedBone.start, y: Number(event.target.value) || 0 } } })} /></label>
              <label className="control-row"><span>End X</span><input type="number" value={selectedBone.end.x} onChange={(event) => dispatch({ type: 'rigging_update_bone', boneId: selectedBone.id, updates: { end: { ...selectedBone.end, x: Number(event.target.value) || 0 } } })} /></label>
              <label className="control-row"><span>End Y</span><input type="number" value={selectedBone.end.y} onChange={(event) => dispatch({ type: 'rigging_update_bone', boneId: selectedBone.id, updates: { end: { ...selectedBone.end, y: Number(event.target.value) || 0 } } })} /></label>
            </>
          )}
        </section>
      )}

      {tab === 'lighting' && (
        <section className="panel">
          <h2><Sparkles size={14} /> Dynamic Light Shader</h2>
          <p className="subhead">Realtime lighting pass over the current composite for preview.</p>
          <button onClick={() => dispatch({ type: 'lighting_toggle' })}>{lighting.enabled ? 'Disable Lighting' : 'Enable Lighting'}</button>
          <label className="control-row"><span>Direction</span><input type="range" min="0" max="360" value={lighting.direction} onChange={(event) => dispatch({ type: 'lighting_set', updates: { direction: Number(event.target.value) } })} /></label>
          <label className="control-row"><span>Intensity</span><input type="range" min="0" max="1" step="0.01" value={lighting.intensity} onChange={(event) => dispatch({ type: 'lighting_set', updates: { intensity: Number(event.target.value) } })} /></label>
          <label className="control-row"><span>Ambient</span><input type="range" min="0" max="1" step="0.01" value={lighting.ambient} onChange={(event) => dispatch({ type: 'lighting_set', updates: { ambient: Number(event.target.value) } })} /></label>
          <label className="control-row"><span>Light Tint</span><input type="color" value={lighting.color} onChange={(event) => dispatch({ type: 'lighting_set', updates: { color: event.target.value } })} /></label>
        </section>
      )}
    </aside>
  );
}
