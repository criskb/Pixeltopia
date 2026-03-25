import { useEffect, useMemo, useRef, useState } from 'react';
import { applyTool } from './tools';
import { cloneBuffer } from './pixelBuffer';
import { renderCanvasBuffer, renderWrapPreviewBuffer } from './renderPipeline';
import { getSelectionBounds } from './selectionTransforms';
import { useEditorDispatch, useEditorState } from '../state/EditorStateContext';

function getCanvasPixel(event, canvas, zoomLevel, wrapPreviewEnabled, width, height) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / zoomLevel);
  const y = Math.floor((event.clientY - rect.top) / zoomLevel);

  if (!wrapPreviewEnabled) {
    return { x, y };
  }

  return {
    x: ((x % width) + width) % width,
    y: ((y % height) + height) % height,
    rawX: x,
    rawY: y
  };
}

function SelectionOverlay({ bounds, zoomLevel, wrapPreviewEnabled, width, height }) {
  if (!bounds) {
    return null;
  }

  const tiles = wrapPreviewEnabled
    ? [
      { tx: 0, ty: 0 },
      { tx: width, ty: 0 },
      { tx: width * 2, ty: 0 },
      { tx: 0, ty: height },
      { tx: width, ty: height },
      { tx: width * 2, ty: height },
      { tx: 0, ty: height * 2 },
      { tx: width, ty: height * 2 },
      { tx: width * 2, ty: height * 2 }
    ]
    : [{ tx: 0, ty: 0 }];

  return (
    <>
      {tiles.map((tile) => {
        const left = (tile.tx + bounds.minX) * zoomLevel;
        const top = (tile.ty + bounds.minY) * zoomLevel;
        const boxWidth = bounds.width * zoomLevel;
        const boxHeight = bounds.height * zoomLevel;
        const handles = [
          { left: 0, top: 0 },
          { left: boxWidth / 2, top: 0 },
          { left: boxWidth, top: 0 },
          { left: 0, top: boxHeight / 2 },
          { left: boxWidth, top: boxHeight / 2 },
          { left: 0, top: boxHeight },
          { left: boxWidth / 2, top: boxHeight },
          { left: boxWidth, top: boxHeight }
        ];
        return (
          <div key={`${tile.tx}-${tile.ty}`} className="selection-box" style={{ left, top, width: boxWidth, height: boxHeight }}>
            {handles.map((handle, index) => (
              <span
                key={index}
                className="selection-handle"
                style={{ left: handle.left, top: handle.top }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}


function RigOverlay({ rigging, zoomLevel, width, height, wrapPreviewEnabled, metrics }) {
  if (!rigging?.enabled) {
    return null;
  }

  const offset = { x: 0, y: 0 };

  return (
    <div className="rig-overlay" aria-hidden="true" style={{ left: metrics.left, top: metrics.top, width: metrics.width, height: metrics.height }}>

      {rigging.selectedBoneId && rigging.weights?.[rigging.selectedBoneId] && (
        <div className="rig-mask">
          {Array.from(rigging.weights[rigging.selectedBoneId]).map((value, index) => {
            if (!value) {
              return null;
            }
            const px = index % width;
            const py = Math.floor(index / width);
            return <span key={index} className="rig-mask-pixel" style={{ left: (px + offset.x) * zoomLevel, top: (py + offset.y) * zoomLevel, width: zoomLevel, height: zoomLevel }} />;
          })}
        </div>
      )}

      {rigging.bones.map((bone) => {
        const x1 = (bone.start.x + offset.x) * zoomLevel;
        const y1 = (bone.start.y + offset.y) * zoomLevel;
        const x2 = (bone.end.x + offset.x) * zoomLevel;
        const y2 = (bone.end.y + offset.y) * zoomLevel;
        const length = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        const selected = rigging.selectedBoneId === bone.id;

        return (
          <div key={bone.id} className={selected ? 'rig-bone selected' : 'rig-bone'} style={{ left: x1, top: y1 }}>
            <span className="rig-joint start" />
            <span className="rig-segment" style={{ width: length, transform: `rotate(${angle}deg)` }} />
            <span className="rig-joint end" style={{ left: x2 - x1, top: y2 - y1 }} />
          </div>
        );
      })}
    </div>
  );
}

function ShaderViewportControls({ lighting, material, zoomLevel, overlayMetrics, dispatch }) {
  const fileInputRef = useRef(null);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const lightHandle = useMemo(() => {
    const safePos = lighting.position ?? { x: 0, y: 0 };
    return {
      left: safePos.x * zoomLevel,
      top: safePos.y * zoomLevel
    };
  }, [lighting.position, zoomLevel]);

  const loadHdri = async (file) => {
    try {
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

      dispatch({
        type: 'lighting_set',
        updates: {
          hdriName: file.name,
          hdriDataUrl: dataUrl,
          hdriSamples
        }
      });
    } catch {
      // Ignore invalid files and keep current lighting settings.
    }
  };

  return (
    <div className="shader-overlay" style={{ left: overlayMetrics.left, top: overlayMetrics.top, width: overlayMetrics.width, height: overlayMetrics.height }}>
      {lighting.enabled && (
        <div className="light-handle" style={{ left: lightHandle.left, top: lightHandle.top }} title="Drag to move local light source" aria-hidden="true" />
      )}
      <div className="shader-overlay-panel">
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
            <label className="control-row"><span>Light X</span><input type="number" min="0" max={Math.max(0, Math.round(overlayMetrics.width / Math.max(1, zoomLevel)))} value={Math.round(lighting.position?.x ?? 0)} onChange={(e) => dispatch({ type: 'lighting_set', updates: { position: { ...(lighting.position ?? { x: 0, y: 0 }), x: clamp(Number(e.target.value), 0, Math.max(0, Math.round(overlayMetrics.width / Math.max(1, zoomLevel)))) } } })} /></label>
            <label className="control-row"><span>Light Y</span><input type="number" min="0" max={Math.max(0, Math.round(overlayMetrics.height / Math.max(1, zoomLevel)))} value={Math.round(lighting.position?.y ?? 0)} onChange={(e) => dispatch({ type: 'lighting_set', updates: { position: { ...(lighting.position ?? { x: 0, y: 0 }), y: clamp(Number(e.target.value), 0, Math.max(0, Math.round(overlayMetrics.height / Math.max(1, zoomLevel)))) } } })} /></label>
          </>
        )}
        <label className="control-row"><span>Intensity</span><input type="range" min="0" max="1" step="0.01" value={lighting.intensity} onChange={(e) => dispatch({ type: 'lighting_set', updates: { intensity: Number(e.target.value) } })} /></label>
        <label className="control-row"><span>Ambient</span><input type="range" min="0" max="1" step="0.01" value={lighting.ambient} onChange={(e) => dispatch({ type: 'lighting_set', updates: { ambient: Number(e.target.value) } })} /></label>
        <label className="control-row"><span>Tint</span><input type="color" value={lighting.color} onChange={(e) => dispatch({ type: 'lighting_set', updates: { color: e.target.value } })} /></label>
        <label className="control-row"><span>HDRI Mix</span><input type="range" min="0" max="1" step="0.01" value={lighting.hdriStrength ?? 0.6} onChange={(e) => dispatch({ type: 'lighting_set', updates: { hdriStrength: Number(e.target.value) } })} /></label>
        <div className="preset-row">
          <button onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'point', enabled: true, intensity: 0.9, ambient: 0.22, color: '#ffe0a8' } })}>Key</button>
          <button onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'global', enabled: true, direction: 230, intensity: 0.6, ambient: 0.38, color: '#8cc6ff' } })}>Fill</button>
          <button onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'global', enabled: true, direction: 140, intensity: 0.82, ambient: 0.2, color: '#fff2c4' } })}>Rim</button>
        </div>
        <div className="layer-actions">
          <button onClick={() => fileInputRef.current?.click()}>Load HDRI</button>
          <button onClick={() => dispatch({ type: 'lighting_set', updates: { hdriName: '', hdriDataUrl: '', hdriSamples: null } })} disabled={!lighting.hdriSamples}>Clear HDRI</button>
          <button onClick={() => dispatch({ type: 'lighting_set', updates: { mode: 'point', direction: 40, intensity: 0.7, ambient: 0.35, color: '#ffd38a', hdriStrength: 0.6 } })}>Reset</button>
        </div>
        <p className="subhead">Drag in-canvas while Light tool is active. Active material tool: {material.tool}. {lighting.hdriName ? `HDRI: ${lighting.hdriName}` : 'No HDRI loaded.'}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const [file] = event.target.files ?? [];
            if (file) {
              loadHdri(file);
            }
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export default function CanvasViewport() {
  const canvasRef = useRef(null);
  const lassoRef = useRef([]);
  const rectStartRef = useRef(null);
  const dragBoneRef = useRef(null);
  const lastPointRef = useRef(null);
  const {
    project,
    pixelBuffer,
    zoomLevel,
    activeTool,
    currentColor,
    brushSize,
    selectedLayerId,
    selectionMask,
    wrapPreviewEnabled,
    wrapOffset,
    width,
    height,
    rigging,
    lighting,
    material,
    workspaceMode
  } = useEditorState();
  const dispatch = useEditorDispatch();
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLightDragging, setIsLightDragging] = useState(false);
  const [overlayMetrics, setOverlayMetrics] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const selectionBounds = useMemo(() => getSelectionBounds(selectionMask), [selectionMask]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const renderBuffer = renderCanvasBuffer(project, lighting, rigging, material);
    const displayBuffer = wrapPreviewEnabled ? renderWrapPreviewBuffer(renderBuffer, wrapOffset) : renderBuffer;

    canvas.width = displayBuffer.width;
    canvas.height = displayBuffer.height;
    canvas.style.width = `${displayBuffer.width * zoomLevel}px`;
    canvas.style.height = `${displayBuffer.height * zoomLevel}px`;
    ctx.imageSmoothingEnabled = false;

    const imageData = new ImageData(displayBuffer.data, displayBuffer.width, displayBuffer.height);
    ctx.putImageData(imageData, 0, 0);
    setOverlayMetrics({
      left: canvas.offsetLeft,
      top: canvas.offsetTop,
      width: canvas.clientWidth,
      height: canvas.clientHeight
    });
  }, [project, lighting, rigging, material, zoomLevel, wrapPreviewEnabled, wrapOffset]);

  function applyPointerAction(event) {
    if (workspaceMode === 'shader' && material.tool !== 'light') {
      const canvas = canvasRef.current;
      const { x, y } = getCanvasPixel(event, canvas, zoomLevel, wrapPreviewEnabled, width, height);
      dispatch({ type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint', x, y, radius: 1 });
      return;
    }

    if (workspaceMode !== 'draw') {
      return;
    }

    const activeLayer = project.layers.find((layer) => layer.id === selectedLayerId);
    if (activeLayer?.locked) {
      return;
    }

    const canvas = canvasRef.current;
    const { x, y } = getCanvasPixel(event, canvas, zoomLevel, wrapPreviewEnabled, width, height);
    dispatch({ type: 'set_cursor', cursor: { x, y } });

    if (activeTool === 'select-rect' || activeTool === 'select-lasso') {
      return;
    }

    const nextBuffer = cloneBuffer(pixelBuffer);
    const result = applyTool(nextBuffer, {
      tool: activeTool,
      x,
      y,
      color: currentColor,
      brushSize
    });

    if (result.pickedColor) {
      dispatch({ type: 'set_color', color: result.pickedColor });
    }

    if (result.changed) {
      dispatch({ type: 'update_pixels', pixelBuffer: nextBuffer });
    }
  }

  return (
    <div className="canvas-stage">
      <canvas
        ref={canvasRef}
        className="canvas"
        role="img"
        aria-label="Pixel canvas editor"
        onPointerDown={(event) => {
          setIsDrawing(true);
          const { x, y } = getCanvasPixel(event, canvasRef.current, zoomLevel, wrapPreviewEnabled, width, height);
          if (workspaceMode === 'shader' && material.tool === 'light') {
            setIsLightDragging(true);
            dispatch({
              type: 'lighting_set',
              updates: {
                enabled: true,
                position: { x, y },
                direction: (Math.atan2((height / 2) - y, (width / 2) - x) * 180) / Math.PI
              }
            });
            return;
          }
          if (workspaceMode === 'shader' && material.tool !== 'light') {
            dispatch({ type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint', x, y, radius: 1 });
            return;
          }

          if (workspaceMode === 'rigging') {
            if (!rigging.enabled) {
              dispatch({ type: 'rigging_toggle' });
            }
            lastPointRef.current = { x, y };
            if (rigging.tool === 'draw') {
              dispatch({ type: 'rigging_start_draw', start: { x, y } });
            } else if (rigging.tool === 'move') {
              dragBoneRef.current = rigging.selectedBoneId;
            } else if (rigging.tool === 'weight') {
              dispatch({ type: 'rigging_paint_weight', x, y, radius: 1 });
            } else {
              dispatch({ type: 'rigging_ik_drag', target: { x, y } });
            }
            return;
          }
          if (activeTool === 'select-rect') {
            rectStartRef.current = { x, y };
          }
          if (activeTool === 'select-lasso') {
            lassoRef.current = [{ x, y }];
          }
          applyPointerAction(event);
        }}
        onPointerMove={(event) => {
          const point = getCanvasPixel(event, canvasRef.current, zoomLevel, wrapPreviewEnabled, width, height);
          if (workspaceMode === 'shader' && isLightDragging && material.tool === 'light') {
            const centerX = width / 2;
            const centerY = height / 2;
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const maxDist = Math.max(1, Math.hypot(width, height) / 2);
            dispatch({
              type: 'lighting_set',
              updates: {
                enabled: true,
                position: { x: point.x, y: point.y },
                direction: (Math.atan2(dy, dx) * 180) / Math.PI,
                intensity: Math.max(0.1, Math.min(1, Math.hypot(dx, dy) / maxDist))
              }
            });
            return;
          }
          if (workspaceMode === 'shader' && isDrawing && material.tool !== 'light') {
            dispatch({ type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint', x: point.x, y: point.y, radius: 1 });
            return;
          }

          if (workspaceMode === 'rigging' && isDrawing) {
            if (rigging.tool === 'draw') {
              dispatch({ type: 'rigging_update_draw', end: { x: point.x, y: point.y } });
            } else if (rigging.tool === 'move' && dragBoneRef.current && lastPointRef.current) {
              dispatch({
                type: 'rigging_move_bone',
                boneId: dragBoneRef.current,
                dx: point.x - lastPointRef.current.x,
                dy: point.y - lastPointRef.current.y
              });
              lastPointRef.current = { x: point.x, y: point.y };
            } else if (rigging.tool === 'weight') {
              dispatch({ type: 'rigging_paint_weight', x: point.x, y: point.y, radius: 1 });
            } else {
              dispatch({ type: 'rigging_ik_drag', target: { x: point.x, y: point.y } });
            }
            return;
          }

          if (isDrawing && activeTool === 'select-lasso') {
            lassoRef.current.push({ x: point.x, y: point.y });
          }

          if (isDrawing && activeTool !== 'fill' && activeTool !== 'picker' && activeTool !== 'select-rect' && activeTool !== 'select-lasso') {
            applyPointerAction(event);
          } else {
            dispatch({ type: 'set_cursor', cursor: { x: point.x, y: point.y } });
          }
        }}
        onPointerUp={(event) => {
          const point = getCanvasPixel(event, canvasRef.current, zoomLevel, wrapPreviewEnabled, width, height);
          if (workspaceMode === 'shader' && material.tool === 'light') {
            dispatch({ type: 'lighting_set', updates: { enabled: true, position: { x: point.x, y: point.y } } });
            setIsDrawing(false);
            setIsLightDragging(false);
            return;
          }
          if (workspaceMode === 'shader' && material.tool !== 'light') {
            dispatch({ type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint', x: point.x, y: point.y, radius: 1 });
            setIsDrawing(false);
            return;
          }

          if (workspaceMode === 'rigging') {
            if (rigging.tool === 'draw') {
              dispatch({ type: 'rigging_commit_draw', connect: true });
            }
            dragBoneRef.current = null;
            lastPointRef.current = null;
            setIsDrawing(false);
            return;
          }

          if (activeTool === 'select-rect' && rectStartRef.current) {
            const end = getCanvasPixel(event, canvasRef.current, zoomLevel, wrapPreviewEnabled, width, height);
            dispatch({ type: 'selection_rect', start: rectStartRef.current, end });
            rectStartRef.current = null;
          }
          if (activeTool === 'select-lasso' && lassoRef.current.length > 1) {
            dispatch({ type: 'selection_lasso', points: lassoRef.current });
            lassoRef.current = [];
          }
          setIsDrawing(false);
        }}
        onPointerLeave={() => {
          setIsDrawing(false);
          setIsLightDragging(false);
          rectStartRef.current = null;
          lassoRef.current = [];
          dragBoneRef.current = null;
          lastPointRef.current = null;
        }}
      />
      {workspaceMode === 'rigging' && (<RigOverlay rigging={rigging} zoomLevel={zoomLevel} width={width} height={height} wrapPreviewEnabled={wrapPreviewEnabled} metrics={overlayMetrics} />)}
      {workspaceMode === 'shader' && (
        <ShaderViewportControls lighting={lighting} material={material} zoomLevel={zoomLevel} overlayMetrics={overlayMetrics} dispatch={dispatch} />
      )}
      {workspaceMode === 'rigging' && rigging.draftBone && (
        <div
          className="rig-draft"
          style={{
            left: overlayMetrics.left + rigging.draftBone.start.x * zoomLevel,
            top: overlayMetrics.top + rigging.draftBone.start.y * zoomLevel,
            width: Math.hypot((rigging.draftBone.end.x - rigging.draftBone.start.x) * zoomLevel, (rigging.draftBone.end.y - rigging.draftBone.start.y) * zoomLevel),
            transform: `rotate(${Math.atan2(rigging.draftBone.end.y - rigging.draftBone.start.y, rigging.draftBone.end.x - rigging.draftBone.start.x) * (180 / Math.PI)}deg)`
          }}
        />
      )}

      <SelectionOverlay bounds={selectionBounds} zoomLevel={zoomLevel} wrapPreviewEnabled={wrapPreviewEnabled} width={width} height={height} />
    </div>
  );
}
