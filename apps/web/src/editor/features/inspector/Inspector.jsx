import { useMemo } from 'react';
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
  Sparkles,
  Clapperboard
} from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';
import ThreePreview from '../shader/ThreePreview';

const swatches = ['#1D1D1D', '#FFFFFF', '#7C5CFF', '#00C2FF', '#37D67A', '#FFB020', '#FF5D73', '#8B5CF6'];
const blendModes = ['normal', 'multiply', 'screen', 'add'];

export default function Inspector() {
  const {
    currentColor,
    brushSize,
    zoomLevel,
    layers,
    selectedLayerId,
    onionSkin,
    wrapPreviewEnabled,
    rigging,
    lighting,
    material,
    workspaceMode,
    frames,
    selectedFrameId
  } = useEditorState();
  const dispatch = useEditorDispatch();
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const selectedBone = useMemo(() => rigging.bones.find((bone) => bone.id === (rigging.selectedBoneId ?? rigging.bones[0]?.id)), [rigging]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];

  return (
    <aside className="inspector" aria-label="Inspector panels">
      {workspaceMode === 'draw' && (
        <>
          <section className="panel">
            <h2><Palette size={14} /> Palette</h2>
            <div className="swatch-grid">
              {swatches.map((color) => (
                <button key={color} className={currentColor === color ? 'swatch selected' : 'swatch'} style={{ background: color }} onClick={() => dispatch({ type: 'set_color', color })} />
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
                <label className="control-row"><span>Blend</span><select value={selectedLayer.blendMode ?? 'normal'} onChange={(e) => dispatch({ type: 'layer_set_blend_mode', layerId: selectedLayer.id, blendMode: e.target.value })}>{blendModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                <label className="control-row" htmlFor="layerOpacity"><span>Opacity</span><input id="layerOpacity" type="range" min="0" max="100" value={Math.round((selectedLayer.opacity ?? 1) * 100)} onChange={(e) => dispatch({ type: 'layer_set_opacity', layerId: selectedLayer.id, opacity: Number(e.target.value) / 100 })} /></label>
              </>
            )}
          </section>

          <section className="panel">
            <h2><Repeat2 size={14} /> Draw Tools</h2>
            <label className="control-row" htmlFor="brushSize"><span>Brush</span><input id="brushSize" type="range" min="1" max="8" value={brushSize} onChange={(e) => dispatch({ type: 'set_brush_size', size: Number(e.target.value) })} /></label>
            <div className="control-row"><span>Zoom</span><strong>{zoomLevel * 100}%</strong></div>
            <p className="subhead">Painting tools enabled in this mode.</p>
          </section>
        </>
      )}

      {workspaceMode === 'animate' && (
        <section className="panel">
          <h2><Clapperboard size={14} /> Animation Tools</h2>
          <div className="control-row"><span>Frame</span><strong>{selectedFrame ? frames.indexOf(selectedFrame) + 1 : 1}</strong></div>
          <label className="control-row"><span>Frame Duration</span><input type="number" min="1" max="12" value={selectedFrame?.duration ?? 1} onChange={(e) => dispatch({ type: 'frame_set_duration', frameId: selectedFrameId, duration: Number(e.target.value) })} /></label>
          <button onClick={() => dispatch({ type: 'onion_toggle' })}>{onionSkin.enabled ? 'Disable Onion Skin' : 'Enable Onion Skin'}</button>
          <button onClick={() => dispatch({ type: 'wrap_preview_toggle' })}>{wrapPreviewEnabled ? 'Disable Wrap Preview' : 'Enable Wrap Preview'}</button>
          <p className="subhead">Animation helpers are isolated here; draw edits are disabled while animating.</p>
        </section>
      )}

      {workspaceMode === 'rigging' && (
        <section className="panel">
          <h2><Bone size={14} /> IK Rigging</h2>
          <p className="subhead">Draw connected bones, move them, paint skin weights, and keyframe integer bone offsets.</p>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'rigging_toggle' })}>{rigging.enabled ? 'Hide Rig Overlay' : 'Show Rig Overlay'}</button>
            <button onClick={() => dispatch({ type: 'rigging_add_bone' })}><Plus size={14} />Bone</button>
          </div>
          <button onClick={() => dispatch({ type: 'rigging_keyframe_set' })}>Set Bone Keyframe (Pixel Perfect)</button>
          <ul className="layer-list">
            {rigging.bones.map((bone) => (
              <li key={bone.id} className={bone.id === selectedBone?.id ? 'layer-row selected' : 'layer-row'}>
                <button onClick={() => dispatch({ type: 'rigging_select_bone', boneId: bone.id })}>{bone.name}</button>
                <button onClick={() => dispatch({ type: 'rigging_delete_bone', boneId: bone.id })} disabled={rigging.bones.length <= 1}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workspaceMode === 'shader' && (
        <section className="panel">
          <h2><Sparkles size={14} /> Dynamic Light Shader</h2>
          <button onClick={() => dispatch({ type: 'lighting_toggle' })}>{lighting.enabled ? 'Disable Lighting' : 'Enable Lighting'}</button>
          <label className="control-row"><span>Direction</span><input type="range" min="0" max="360" value={lighting.direction} onChange={(e) => dispatch({ type: 'lighting_set', updates: { direction: Number(e.target.value) } })} /></label>
          <label className="control-row"><span>Intensity</span><input type="range" min="0" max="1" step="0.01" value={lighting.intensity} onChange={(e) => dispatch({ type: 'lighting_set', updates: { intensity: Number(e.target.value) } })} /></label>
          <label className="control-row"><span>Ambient</span><input type="range" min="0" max="1" step="0.01" value={lighting.ambient} onChange={(e) => dispatch({ type: 'lighting_set', updates: { ambient: Number(e.target.value) } })} /></label>
          <label className="control-row"><span>Light Tint</span><input type="color" value={lighting.color} onChange={(e) => dispatch({ type: 'lighting_set', updates: { color: e.target.value } })} /></label>
          <label className="control-row"><span>Emissive Strength</span><input type="range" min="0" max="1" step="0.01" value={material.emissiveStrength} onChange={(e) => dispatch({ type: 'material_set_strength', value: Number(e.target.value) })} /></label>
          <button onClick={() => dispatch({ type: 'material_clear_emissive' })}>Clear Emissive Mask</button>
          <p className="subhead">Use Shader → Emissive tool in the rail and paint directly on canvas for live glow preview.</p>
          <div className="preset-row">
            <button onClick={() => dispatch({ type: 'lighting_set', updates: { direction: 30, intensity: 0.75, ambient: 0.25, color: '#ffd38a' } })}>Sunrise</button>
            <button onClick={() => dispatch({ type: 'lighting_set', updates: { direction: 220, intensity: 0.65, ambient: 0.4, color: '#8ac6ff' } })}>Moonlight</button>
            <button onClick={() => dispatch({ type: 'lighting_set', updates: { direction: 90, intensity: 0.9, ambient: 0.2, color: '#fff0b8' } })}>Top Light</button>
          </div>
          <ThreePreview />
        </section>
      )}
    </aside>
  );
}
