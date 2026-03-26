import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import { renderCanvasBuffer } from '../../canvas/renderPipeline';
import {
  buildDepthTextureData,
  buildGrayscaleTextureData,
  buildHeightTextureData,
  buildNormalTextureData
} from '../shader/materialMaps';
import ColorControls from './ColorControls';
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
    selectedFrameId,
    project
  } = useEditorState();
  const dispatch = useEditorDispatch();
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const selectedBone = useMemo(() => rigging.bones.find((bone) => bone.id === (rigging.selectedBoneId ?? rigging.bones[0]?.id)), [rigging]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];
  const hdriInputRef = useRef(null);
  const materialMapInputRef = useRef(null);
  const [pendingImportChannel, setPendingImportChannel] = useState(null);
  const [resizeDraft, setResizeDraft] = useState({ width, height });
  const materialCoverage = useMemo(() => {
    const total = Math.max(1, width * height);
    const coverageOf = (mask) => {
      const active = mask?.reduce((count, value) => count + (value > 0 ? 1 : 0), 0) ?? 0;
      return Math.round((active / total) * 100);
    };
    return {
      emissive: coverageOf(material.emissiveMask),
      roughness: coverageOf(material.roughnessMask),
      metalness: coverageOf(material.metalnessMask),
      height: coverageOf(material.heightMask)
    };
  }, [material, width, height]);

  useEffect(() => {
    setResizeDraft({ width, height });
  }, [width, height]);

  const loadHdri = async (file) => {
    try {
      const isExr = file.name.toLowerCase().endsWith('.exr');
      if (isExr) {
        const hdriDataUrl = URL.createObjectURL(file);
        dispatch({ type: 'lighting_set', updates: { hdriName: file.name, hdriFormat: 'exr', hdriDataUrl, hdriSamples: null } });
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

  const downloadMaterialMap = (kind) => {
    const composite = renderCanvasBuffer(project, null, null, material);
    const widthPx = composite.width;
    const heightPx = composite.height;
    let data = new Uint8Array(composite.data);

    if (kind === 'roughness') {
      data = buildGrayscaleTextureData(material.roughnessMask, widthPx, heightPx, material.roughnessStrength ?? 0.6);
    } else if (kind === 'metalness') {
      data = buildGrayscaleTextureData(material.metalnessMask, widthPx, heightPx, material.metalnessStrength ?? 0.35);
    } else if (kind === 'height') {
      data = buildHeightTextureData(composite, material.heightMask, material.heightStrength ?? 0.35);
    } else if (kind === 'normal') {
      const heightData = buildHeightTextureData(composite, material.heightMask, material.heightStrength ?? 0.35);
      data = buildNormalTextureData(heightData, widthPx, heightPx, material.normalStrength ?? 0.8);
    } else if (kind === 'depth') {
      const heightData = buildHeightTextureData(composite, material.heightMask, material.heightStrength ?? 0.35);
      data = buildDepthTextureData(heightData);
    }

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), widthPx, heightPx), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pixeltopia-${kind}.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const importMaterialMask = async (file, channel) => {
    const targetChannel = channel ?? pendingImportChannel;
    if (!targetChannel) {
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read mask image'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode mask image'));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      const px = i * 4;
      mask[i] = Math.round(0.2126 * pixels[px] + 0.7152 * pixels[px + 1] + 0.0722 * pixels[px + 2]);
    }
    dispatch({ type: 'material_set_mask', channel: targetChannel, mask });
    setPendingImportChannel(null);
  };

  const adjustMaterialMask = (channel, operation) => {
    dispatch({ type: 'material_adjust_mask', channel, operation });
  };

  return (
    <aside className="inspector" aria-label="Inspector panels">
      {workspaceMode === 'draw' && (
        <>
          <section className="panel">
            <h2><Palette size={14} /> Palette</h2>
            <ColorControls color={currentColor} onChange={(color) => dispatch({ type: 'set_color', color })} />
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
            <div className="control-row">
              <span>Zoom</span>
              <div className="layer-actions">
                <button onClick={() => dispatch({ type: 'set_zoom', zoom: Math.max(2, zoomLevel - 1) })}>-</button>
                <strong>{zoomLevel * 100}%</strong>
                <button onClick={() => dispatch({ type: 'set_zoom', zoom: Math.min(32, zoomLevel + 1) })}>+</button>
              </div>
            </div>
            <label className="control-row"><span>Doc Width</span><input type="number" min="1" max="512" value={resizeDraft.width} onChange={(e) => setResizeDraft((prev) => ({ ...prev, width: Number(e.target.value) }))} /></label>
            <label className="control-row"><span>Doc Height</span><input type="number" min="1" max="512" value={resizeDraft.height} onChange={(e) => setResizeDraft((prev) => ({ ...prev, height: Number(e.target.value) }))} /></label>
            <button onClick={() => dispatch({ type: 'project_resize', width: resizeDraft.width, height: resizeDraft.height })}>Apply Canvas Resize</button>
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
            <button onClick={() => dispatch({ type: 'rigging_select_next_bone' })}>Next Bone</button>
          </div>
          <label className="control-row"><span>Weight Brush</span><input type="range" min="1" max="16" value={rigging.weightBrushRadius ?? 2} onChange={(e) => dispatch({ type: 'rigging_set_weight_radius', radius: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Auto Skin Radius</span><input type="range" min="2" max="20" value={rigging.autoSkinRadius ?? 7} onChange={(e) => dispatch({ type: 'rigging_set_auto_skin_radius', radius: Number(e.target.value) })} /></label>
          <button onClick={() => dispatch({ type: 'rigging_keyframe_set' })}>Set Bone Keyframe (Pixel Perfect)</button>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'rigging_auto_skin_selected', radius: rigging.autoSkinRadius ?? 7 })}>Auto Skin Selected</button>
            <button onClick={() => dispatch({ type: 'rigging_auto_skin_all', radius: rigging.autoSkinRadius ?? 7 })}>Auto Skin All</button>
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
          <label className="control-row"><span>HDRI Rotation</span><input type="range" min="-180" max="180" step="1" value={lighting.hdriRotation ?? 0} onChange={(e) => dispatch({ type: 'lighting_set', updates: { hdriRotation: Number(e.target.value) } })} /></label>
          <div className="layer-actions">
            <button onClick={() => hdriInputRef.current?.click()}>Load HDRI</button>
            <button onClick={() => dispatch({ type: 'lighting_set', updates: { hdriName: '', hdriFormat: '', hdriDataUrl: '', hdriSamples: null, hdriRotation: 0 } })} disabled={!lighting.hdriDataUrl}>Clear HDRI</button>
          </div>
          <label className="control-row"><span>Emissive Strength</span><input type="range" min="0" max="1" step="0.01" value={material.emissiveStrength} onChange={(e) => dispatch({ type: 'material_set_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Roughness Strength</span><input type="range" min="0" max="1" step="0.01" value={material.roughnessStrength} onChange={(e) => dispatch({ type: 'material_set_roughness_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Metalness Strength</span><input type="range" min="0" max="1" step="0.01" value={material.metalnessStrength} onChange={(e) => dispatch({ type: 'material_set_metalness_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Height Strength</span><input type="range" min="0" max="1" step="0.01" value={material.heightStrength ?? 0.35} onChange={(e) => dispatch({ type: 'material_set_height_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Normal Strength</span><input type="range" min="0" max="2" step="0.01" value={material.normalStrength ?? 0.8} onChange={(e) => dispatch({ type: 'material_set_normal_strength', value: Number(e.target.value) })} /></label>
          <label className="control-row">
            <span>Preview Map</span>
            <select value={material.previewMode ?? 'lit'} onChange={(e) => dispatch({ type: 'material_set_preview_mode', mode: e.target.value })}>
              <option value="lit">Lit Composite</option>
              <option value="roughness">Roughness</option>
              <option value="metalness">Metalness</option>
              <option value="height">Height</option>
              <option value="normal">Normal</option>
              <option value="depth">Depth</option>
            </select>
          </label>
          <label className="control-row"><span>Material Brush Radius</span><input type="range" min="1" max="12" step="1" value={material.brushRadius ?? 1} onChange={(e) => dispatch({ type: 'material_set_brush_radius', radius: Number(e.target.value) })} /></label>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'material_apply_preset', preset: 'matte_paint' })}>Preset Matte</button>
            <button onClick={() => dispatch({ type: 'material_apply_preset', preset: 'brushed_metal' })}>Preset Metal</button>
            <button onClick={() => dispatch({ type: 'material_apply_preset', preset: 'glossy_plastic' })}>Preset Plastic</button>
            <button onClick={() => dispatch({ type: 'material_apply_preset', preset: 'emissive_fx' })}>Preset Emissive</button>
          </div>
          <label className="control-row"><span>Emissive Paint</span><input type="range" min="0" max="1" step="0.01" value={material.emissivePaintValue ?? 1} onChange={(e) => dispatch({ type: 'material_set_paint_value', channel: 'emissivePaintValue', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Roughness Paint</span><input type="range" min="0" max="1" step="0.01" value={material.roughnessPaintValue ?? 0.7} onChange={(e) => dispatch({ type: 'material_set_paint_value', channel: 'roughnessPaintValue', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Metalness Paint</span><input type="range" min="0" max="1" step="0.01" value={material.metalnessPaintValue ?? 0.65} onChange={(e) => dispatch({ type: 'material_set_paint_value', channel: 'metalnessPaintValue', value: Number(e.target.value) })} /></label>
          <label className="control-row"><span>Height Paint</span><input type="range" min="0" max="1" step="0.01" value={material.heightPaintValue ?? 0.5} onChange={(e) => dispatch({ type: 'material_set_paint_value', channel: 'heightPaintValue', value: Number(e.target.value) })} /></label>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'material_generate_height_from_sprite', gain: 1 })}>Auto Height from Sprite</button>
            <button onClick={() => dispatch({ type: 'material_generate_height_from_sprite', gain: 1.35 })}>Boosted Height</button>
            <button onClick={() => dispatch({ type: 'material_generate_roughness_from_sprite', gain: 1, invert: true })}>Auto Roughness</button>
            <button onClick={() => dispatch({ type: 'material_generate_metalness_from_sprite', gain: 1 })}>Auto Metalness</button>
          </div>
          <div className="layer-actions">
            <button onClick={() => dispatch({ type: 'material_clear_emissive' })}>Clear Emissive</button>
            <button onClick={() => dispatch({ type: 'material_clear_roughness' })}>Clear Roughness</button>
            <button onClick={() => dispatch({ type: 'material_clear_metalness' })}>Clear Metalness</button>
            <button onClick={() => dispatch({ type: 'material_clear_height' })}>Clear Height</button>
          </div>
          <div className="layer-actions">
            <button onClick={() => downloadMaterialMap('roughness')}>Export Roughness</button>
            <button onClick={() => downloadMaterialMap('metalness')}>Export Metalness</button>
            <button onClick={() => downloadMaterialMap('height')}>Export Height</button>
            <button onClick={() => downloadMaterialMap('normal')}>Export Normal</button>
            <button onClick={() => downloadMaterialMap('depth')}>Export Depth</button>
          </div>
          <div className="layer-actions">
            <button onClick={() => { setPendingImportChannel('roughnessMask'); materialMapInputRef.current?.click(); }}>Import Roughness</button>
            <button onClick={() => { setPendingImportChannel('metalnessMask'); materialMapInputRef.current?.click(); }}>Import Metalness</button>
            <button onClick={() => { setPendingImportChannel('heightMask'); materialMapInputRef.current?.click(); }}>Import Height</button>
          </div>
          <div className="layer-actions">
            <button onClick={() => adjustMaterialMask('roughnessMask', 'invert')}>Invert Roughness</button>
            <button onClick={() => adjustMaterialMask('metalnessMask', 'invert')}>Invert Metalness</button>
            <button onClick={() => adjustMaterialMask('heightMask', 'invert')}>Invert Height</button>
          </div>
          <div className="layer-actions">
            <button onClick={() => adjustMaterialMask('roughnessMask', 'normalize')}>Normalize Roughness</button>
            <button onClick={() => adjustMaterialMask('metalnessMask', 'normalize')}>Normalize Metalness</button>
            <button onClick={() => adjustMaterialMask('heightMask', 'normalize')}>Normalize Height</button>
          </div>
          <p className="subhead">Coverage · Emissive {materialCoverage.emissive}% · Roughness {materialCoverage.roughness}% · Metalness {materialCoverage.metalness}% · Height {materialCoverage.height}%.</p>
          <p className="subhead">Lighting controls are now in this right inspector panel. Drag light in-canvas with the Light tool for direct placement. Active: {material.tool}. Normal/depth response is generated automatically from height + sprite data. {lighting.hdriName ? `HDRI: ${lighting.hdriName}` : 'No HDRI loaded.'}</p>
          <input
            ref={materialMapInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (event) => {
              const [file] = event.target.files ?? [];
              if (file) {
                try {
                  await importMaterialMask(file);
                } catch {
                  // ignore invalid mask imports
                }
              }
              event.target.value = '';
            }}
          />
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
