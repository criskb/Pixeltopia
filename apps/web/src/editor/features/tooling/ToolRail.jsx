import { Brush, Eraser, PaintBucket, Pipette, RectangleHorizontal, Lasso, Bone, Move3d, SunMedium, Clapperboard } from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

const drawTools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B', icon: Brush },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { key: 'fill', label: 'Fill', shortcut: 'G', icon: PaintBucket },
  { key: 'picker', label: 'Picker', shortcut: 'I', icon: Pipette },
  { key: 'select-rect', label: 'Rect', shortcut: 'M', icon: RectangleHorizontal },
  { key: 'select-lasso', label: 'Lasso', shortcut: 'L', icon: Lasso }
];

const modeTools = {
  animate: [{ key: 'timeline', label: 'Timeline', shortcut: 'T', icon: Clapperboard }],
  rigging: [{ key: 'ik-chain', label: 'IK Chain', shortcut: 'R', icon: Bone }, { key: 'pose', label: 'Pose', shortcut: 'P', icon: Move3d }],
  shader: [{ key: 'light', label: 'Light', shortcut: 'L', icon: SunMedium }]
};

export default function ToolRail() {
  const { activeTool, workspaceMode } = useEditorState();
  const dispatch = useEditorDispatch();
  const tools = workspaceMode === 'draw' ? drawTools : (modeTools[workspaceMode] ?? []);

  return (
    <aside className="tool-rail" aria-label="Tool rail">
      <div className="rail-title">{workspaceMode === 'draw' ? 'Draw Tools' : `${workspaceMode} tools`}</div>
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = workspaceMode === 'draw' ? tool.key === activeTool : false;
        return (
          <button
            key={tool.key}
            className={isActive ? 'tool-btn active' : 'tool-btn'}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => {
              if (workspaceMode === 'draw') {
                dispatch({ type: 'set_active_tool', tool: tool.key });
              }
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
            <span className="tool-name">{tool.label}</span>
            <span className="shortcut">{tool.shortcut}</span>
          </button>
        );
      })}
    </aside>
  );
}
