import { Suspense, lazy, useMemo, useRef } from 'react';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
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
const ThreePreview = lazy(() => import('../shader/ThreePreview'));

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
    width,
    height,
    workspaceMode,
    frames,
    selectedFrameId
  } = useEditorState();
  const dispatch = useEditorDispatch();
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const selectedBone = useMemo(() => rigging.bones.find((bone) => bone.id === (rigging.selectedBoneId ?? rigging.bones[0]?.id)), [rigging]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];
  const hdriInputRef = useRef(null);

  const loadHdri = async (file) => {
    try {
      const isExr = file.name.toLowerCase().endsWith('.exr');
      if (isExr) {
        const arrayBuffer = await file.arrayBuffer();
        const exrLoader = new EXRLoader();
        const texture = exrLoader.parse(arrayBuffer);
        const width = texture.image.width;
        const height = texture.image.height;
        const data = texture.image.data;
        const channels = data.length / (width * height);
        const toByte = (value) => Math.max(0, Math.min(255, Math.round((value ** (1 / 2.2)) * 255)));
        const hdriSamples = Array.from({ length: 64 }, (_, sampleIndex) => {
          const sx = Math.min(width - 1, Math.floor((sampleIndex / 63) * (width - 1)));
          const sy = Math.floor(height * 0.5);
          const i = (sy * width + sx) * channels;
          return [toByte(data[i] ?? 0), toByte(data[i + 1] ?? 0), toByte(data[i + 2] ?? 0)];
        });
        const hdriDataUrl = URL.createObjectURL(file);
        dispatch({ type: 'lighting_set', updates: { hdriName: file.name, hdriFormat: 'exr', hdriDataUrl, hdriSamples } });
        return;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read HDRI file'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode HDRI image'));
        img.src = dataUrl;
      });
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 64;
      sampleCanvas.height = 1;
      const ctx = sampleCanvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const row = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const hdriSamples = Array.from({ length: sampleCanvas.width }, (_, index) => {
        const pixel = index * 4;
        return [row[pixel], row[pixel + 1], row[pixel + 2]];
      });
      dispatch({ type: 'lighting_set', updates: { hdriName: file.name, hdriFormat: 'image', hdriDataUrl: dataUrl, hdriSamples } });
    } catch {
      // Ignore invalid files.
    }
  };

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
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'rigging_auto_skin_selected', radius: 7 })}>Auto Skin Selected</button>
            <button onClick={() => dispatch({ type: 'rigging_auto_skin_all', radius: 8 })}>Auto Skin All</button>
            <button onClick={() => dispatch({ type: 'rigging_clear_selected_weights' })}>Clear Weights</button>
          </div>
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
          <div className="control-row">
            <span>Lighting</span>
            <button onClick={() => dispatch({ type: 'lighting_toggle' })}>{lighting.enabled ? 'On' : 'Off'}</button>
          </div>
          <div className="control-row">
            <span>Mode</span>
            <div className="segmented">
              <button className={lighting.mode === 'point' ? 'active' : ''} onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'point' } })}>Point</button>
              <button className={lighting.mode === 'global' ? 'active' : ''} onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'global' } })}>Global</button>
            </div>
          </div>
          {lighting.mode === 'global' && (
            <label className="control-row"><span>Direction</span><input type="range" min="0" max="360" value={lighting.direction} onChange={(e) => dispatch({ type: 'lighting_set', updates: { direction: Number(e.target.value) } })} /></label>
          )}
          {lighting.mode === 'point' && (
            <>
              <label className="control-row"><span>Light X</span><input type="number" min="0" max={Math.max(0, width - 1)} value={Math.round(lighting.position?.x ?? 0)} onChange={(e) => dispatch({ type: 'lighting_set', updates: { position: { ...(lighting.position ?? { x: 0, y: 0 }), x: Number(e.target.value) } } })} /></label>
              <label className="control-row"><span>Light Y</span><input type="number" min="0" max={Math.max(0, height - 1)} value={Math.round(lighting.position?.y ?? 0)} onChange={(e) => dispatch({ type: 'lighting_set', updates: { position: { ...(lighting.position ?? { x: 0, y: 0 }), y: Number(e.target.value) } } })} /></label>
            </>
          )}
          <label className="control-row"><span>Intensity</span><input type="range" min="0" max="1" step="0.01" value={lighting.intensity} onChange={(e) => dispatch({ type: 'lighting_set', updates: { intensity: Number(e.target.value) } })} /></label>
          <label className="control-row"><span>Ambient</span><input type="range" min="0" max="1" step="0.01" value={lighting.ambient} onChange={(e) => dispatch({ type: 'lighting_set', updates: { ambient: Number(e.target.value) } })} /></label>
          <label className="control-row"><span>Tint</span><input type="color" value={lighting.color} onChange={(e) => dispatch({ type: 'lighting_set', updates: { color: e.target.value } })} /></label>
          <label className="control-row"><span>HDRI Mix</span><input type="range" min="0" max="1" step="0.01" value={lighting.hdriStrength ?? 0.6} onChange={(e) => dispatch({ type: 'lighting_set', updates: { hdriStrength: Number(e.target.value) } })} /></label>
          <div className="layer-actions">
            <button onClick={() => hdriInputRef.current?.click()}>Load HDRI</button>
            <button onClick={() => dispatch({ type: 'lighting_set', updates: { hdriName: '', hdriFormat: '', hdriDataUrl: '', hdriSamples: null } })} disabled={!lighting.hdriSamples}>Clear HDRI</button>
          </div>
          <label className="control-row"><span>Emissive Strength</span><input type="range" min="0" max="1" step="0.01" value={material.emissiveStrength} onChange={(e) => dispatch({ type: 'material_set_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Roughness Strength</span><input type="range" min="0" max="1" step="0.01" value={material.roughnessStrength} onChange={(e) => dispatch({ type: 'material_set_roughness_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Metalness Strength</span><input type="range" min="0" max="1" step="0.01" value={material.metalnessStrength} onChange={(e) => dispatch({ type: 'material_set_metalness_strength', value: Number(e.target.value) })} /></label>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'material_clear_emissive' })}>Clear Emissive</button>
            <button onClick={() => dispatch({ type: 'material_clear_roughness' })}>Clear Roughness</button>
            <button onClick={() => dispatch({ type: 'material_clear_metalness' })}>Clear Metalness</button>
          </div>
          <p className="subhead">Lighting controls are now in this right inspector panel. Drag light in-canvas with the Light tool for direct placement. Active: {material.tool}. {lighting.hdriName ? `HDRI: ${lighting.hdriName}` : 'No HDRI loaded.'}</p>
          <input
            ref={hdriInputRef}
            type="file"
            accept="image/*,.exr"
            hidden
            onChange={(event) => {
              const [file] = event.target.files ?? [];
              if (file) {
                loadHdri(file);
              }
              event.target.value = '';
            }}
          />
          <Suspense fallback={<p className="subhead">Loading 3D shader preview…</p>}><ThreePreview /></Suspense>
        </section>
      )}
    </aside>
  );
}
