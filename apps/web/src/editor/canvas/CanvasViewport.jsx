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

function distanceToBone(point, bone) {
  const segmentX = bone.end.x - bone.start.x;
  const segmentY = bone.end.y - bone.start.y;
  const segmentLen2 = segmentX * segmentX + segmentY * segmentY;
  if (segmentLen2 <= 0.0001) {
    return Math.hypot(point.x - bone.start.x, point.y - bone.start.y);
  }
  const wx = point.x - bone.start.x;
  const wy = point.y - bone.start.y;
  const t = Math.max(0, Math.min(1, (wx * segmentX + wy * segmentY) / segmentLen2));
  const projX = bone.start.x + t * segmentX;
  const projY = bone.start.y + t * segmentY;
  return Math.hypot(point.x - projX, point.y - projY);
}

function findBoneAtPoint(point, bones, threshold = 2.5) {
  let best = null;
  for (const bone of bones) {
    const jointDist = Math.min(
      Math.hypot(point.x - bone.start.x, point.y - bone.start.y),
      Math.hypot(point.x - bone.end.x, point.y - bone.end.y)
    );
    const segmentDist = distanceToBone(point, bone);
    const dist = Math.min(jointDist, segmentDist);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { id: bone.id, dist };
    }
  }
  return best?.id ?? null;
}

function ShaderViewportControls({ lighting, material, zoomLevel, overlayMetrics }) {
  const lightHandle = useMemo(() => {
    const safePos = lighting.position ?? { x: 0, y: 0 };
    return {
      left: safePos.x * zoomLevel,
      top: safePos.y * zoomLevel
    };
  }, [lighting.position, zoomLevel]);

  return (
    <div className="shader-overlay" style={{ left: overlayMetrics.left, top: overlayMetrics.top, width: overlayMetrics.width, height: overlayMetrics.height }}>
      {lighting.enabled && (
        <div className="light-handle" style={{ left: lightHandle.left, top: lightHandle.top }} title="Drag to move local light source" aria-hidden="true" />
      )}
      {material.tool === 'light' && <div className="shader-overlay-hint">Light tool active · drag on canvas to reposition light</div>}
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

  const getMaterialPaintValue = () => {
    if (material.tool.startsWith('roughness')) return material.roughnessPaintValue ?? 0.7;
    if (material.tool.startsWith('metalness')) return material.metalnessPaintValue ?? 0.65;
    if (material.tool.startsWith('height')) return material.heightPaintValue ?? 0.5;
    return material.emissivePaintValue ?? 1;
  };

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
      dispatch({
        type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint',
        x,
        y,
        radius: material.brushRadius ?? 1,
        value: getMaterialPaintValue()
      });
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
            dispatch({
              type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint',
              x,
              y,
              radius: material.brushRadius ?? 1,
              value: getMaterialPaintValue()
            });
            return;
          }

          if (workspaceMode === 'rigging') {
            if (!rigging.enabled) {
              dispatch({ type: 'rigging_toggle' });
            }
            const hitBoneId = findBoneAtPoint({ x, y }, rigging.bones);
            if (hitBoneId) {
              dispatch({ type: 'rigging_select_bone', boneId: hitBoneId });
            }
            lastPointRef.current = { x, y };
            if (rigging.tool === 'draw') {
              dispatch({ type: 'rigging_start_draw', start: { x, y } });
            } else if (rigging.tool === 'move') {
              dragBoneRef.current = hitBoneId ?? rigging.selectedBoneId;
            } else if (rigging.tool === 'weight') {
              dispatch({ type: 'rigging_paint_weight', x, y, radius: rigging.weightBrushRadius ?? 2, boneId: hitBoneId ?? rigging.selectedBoneId });
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
            dispatch({
              type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint',
              x: point.x,
              y: point.y,
              radius: material.brushRadius ?? 1,
              value: getMaterialPaintValue()
            });
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
              dispatch({ type: 'rigging_paint_weight', x: point.x, y: point.y, radius: rigging.weightBrushRadius ?? 2, boneId: rigging.selectedBoneId });
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
            dispatch({
              type: material.tool.endsWith('-erase') ? 'material_erase' : 'material_paint',
              x: point.x,
              y: point.y,
              radius: material.brushRadius ?? 1,
              value: getMaterialPaintValue()
            });
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
      {workspaceMode === 'shader' && (<ShaderViewportControls lighting={lighting} material={material} zoomLevel={zoomLevel} overlayMetrics={overlayMetrics} />)}
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
