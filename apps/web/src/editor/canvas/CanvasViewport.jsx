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


function RigOverlay({ rigging, zoomLevel, width, height, wrapPreviewEnabled }) {
  if (!rigging?.enabled) {
    return null;
  }

  const offset = wrapPreviewEnabled ? { x: width, y: height } : { x: 0, y: 0 };

  return (
    <div className="rig-overlay" aria-hidden="true">
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

export default function CanvasViewport() {
  const canvasRef = useRef(null);
  const lassoRef = useRef([]);
  const rectStartRef = useRef(null);
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
    workspaceMode
  } = useEditorState();
  const dispatch = useEditorDispatch();
  const [isDrawing, setIsDrawing] = useState(false);

  const selectionBounds = useMemo(() => getSelectionBounds(selectionMask), [selectionMask]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const renderBuffer = renderCanvasBuffer(project, lighting);
    const displayBuffer = wrapPreviewEnabled ? renderWrapPreviewBuffer(renderBuffer, wrapOffset) : renderBuffer;

    canvas.width = displayBuffer.width;
    canvas.height = displayBuffer.height;
    canvas.style.width = `${displayBuffer.width * zoomLevel}px`;
    canvas.style.height = `${displayBuffer.height * zoomLevel}px`;
    ctx.imageSmoothingEnabled = false;

    const imageData = new ImageData(displayBuffer.data, displayBuffer.width, displayBuffer.height);
    ctx.putImageData(imageData, 0, 0);
  }, [project, lighting, zoomLevel, wrapPreviewEnabled, wrapOffset]);

  function applyPointerAction(event) {
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
          if (workspaceMode === 'rigging') {
            if (!rigging.enabled) {
              dispatch({ type: 'rigging_toggle' });
            }
            dispatch({ type: 'rigging_ik_drag', target: { x, y } });
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
          if (workspaceMode === 'rigging' && isDrawing) {
            dispatch({ type: 'rigging_ik_drag', target: { x: point.x, y: point.y } });
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
          rectStartRef.current = null;
          lassoRef.current = [];
        }}
      />
      <RigOverlay rigging={rigging} zoomLevel={zoomLevel} width={width} height={height} wrapPreviewEnabled={wrapPreviewEnabled} />
      <SelectionOverlay bounds={selectionBounds} zoomLevel={zoomLevel} wrapPreviewEnabled={wrapPreviewEnabled} width={width} height={height} />
    </div>
  );
}
