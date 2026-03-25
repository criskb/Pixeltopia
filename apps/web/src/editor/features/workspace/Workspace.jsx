import CanvasViewport from '../../canvas/CanvasViewport';
import { useEditorState } from '../../state/EditorStateContext';
import Inspector from '../inspector/Inspector';
import Timeline from '../timeline/Timeline';
import ToolRail from '../tooling/ToolRail';

export default function Workspace() {
  const { activeTool, currentColor, cursor, zoomLevel, width, height, wrapPreviewEnabled } = useEditorState();

  return (
    <>
      <ToolRail />

      <main className="workspace" aria-label="Workspace">
        <div className="canvas-header">
          <span>sprite_idle.png · {width}×{height}</span>
          <span>Zoom {zoomLevel * 100}% · Grid On · Wrap {wrapPreviewEnabled ? '3x3' : 'Off'}</span>
        </div>
        <div className="canvas-backdrop">
          <CanvasViewport />
        </div>
        <div className="statusbar">
          <span>Tool: {activeTool}</span>
          <span>Color: {currentColor}</span>
          <span>Cursor: {cursor.x}, {cursor.y}</span>
        </div>
      </main>

      <Inspector />
      <Timeline />
    </>
  );
}
