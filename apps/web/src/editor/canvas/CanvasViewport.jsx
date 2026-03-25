import { useEffect, useRef, useState } from 'react';
import { applyTool } from './tools';
import { cloneBuffer } from './pixelBuffer';
import { renderCanvasBuffer } from './renderPipeline';
import { useEditorDispatch, useEditorState } from '../state/EditorStateContext';

function getCanvasPixel(event, canvas, zoomLevel) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / zoomLevel);
  const y = Math.floor((event.clientY - rect.top) / zoomLevel);
  return { x, y };
}

export default function CanvasViewport() {
  const canvasRef = useRef(null);
  const { project, pixelBuffer, zoomLevel, activeTool, currentColor, brushSize, selectedLayerId } = useEditorState();
  const dispatch = useEditorDispatch();
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const renderBuffer = renderCanvasBuffer(project);
    canvas.width = renderBuffer.width;
    canvas.height = renderBuffer.height;
    canvas.style.width = `${renderBuffer.width * zoomLevel}px`;
    canvas.style.height = `${renderBuffer.height * zoomLevel}px`;
    ctx.imageSmoothingEnabled = false;

    const imageData = new ImageData(renderBuffer.data, renderBuffer.width, renderBuffer.height);
    ctx.putImageData(imageData, 0, 0);
  }, [project, zoomLevel]);

  function applyPointerAction(event) {
    const activeLayer = project.layers.find((layer) => layer.id === selectedLayerId);
    if (activeLayer?.locked) {
      return;
    }

    const canvas = canvasRef.current;
    const { x, y } = getCanvasPixel(event, canvas, zoomLevel);
    dispatch({ type: 'set_cursor', cursor: { x, y } });

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
    <canvas
      ref={canvasRef}
      className="canvas"
      role="img"
      aria-label="Pixel canvas editor"
      onPointerDown={(event) => {
        setIsDrawing(true);
        applyPointerAction(event);
      }}
      onPointerMove={(event) => {
        if (isDrawing && activeTool !== 'fill' && activeTool !== 'picker') {
          applyPointerAction(event);
        } else {
          const { x, y } = getCanvasPixel(event, canvasRef.current, zoomLevel);
          dispatch({ type: 'set_cursor', cursor: { x, y } });
        }
      }}
      onPointerUp={() => setIsDrawing(false)}
      onPointerLeave={() => setIsDrawing(false)}
    />
  );
}
