import { Brush, Eraser, PaintBucket, Pipette, RectangleHorizontal, Lasso, Bone, Move3d, SunMedium, Clapperboard, Link2, PenSquare } from 'lucide-react';
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
  rigging: [
    { key: 'draw', label: 'Draw Bone', shortcut: 'D', icon: Bone },
    { key: 'move', label: 'Move Bone', shortcut: 'M', icon: Move3d },
    { key: 'weight', label: 'Skin Paint', shortcut: 'W', icon: PenSquare },
    { key: 'ik', label: 'IK Drag', shortcut: 'K', icon: Link2 }
  ],
  shader: [
    { key: 'light', label: 'Light', shortcut: 'L', icon: SunMedium },
    { key: 'emissive', label: 'Emissive+', shortcut: 'E', icon: PenSquare },
    { key: 'emissive-erase', label: 'Emissive-', shortcut: 'R', icon: Eraser },
    { key: 'roughness', label: 'Roughness+', shortcut: 'Q', icon: PenSquare },
    { key: 'roughness-erase', label: 'Roughness-', shortcut: 'W', icon: Eraser },
    { key: 'metalness', label: 'Metalness+', shortcut: 'A', icon: PenSquare },
    { key: 'metalness-erase', label: 'Metalness-', shortcut: 'S', icon: Eraser }
  ]
};

export default function ToolRail() {
  const { activeTool, workspaceMode, rigging, material } = useEditorState();
  const dispatch = useEditorDispatch();
  const tools = workspaceMode === 'draw' ? drawTools : (modeTools[workspaceMode] ?? []);

  return (
    <aside className="tool-rail" aria-label="Tool rail">
      <div className="rail-title">{workspaceMode === 'draw' ? 'Draw Tools' : `${workspaceMode} tools`}</div>
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = workspaceMode === 'draw' ? tool.key === activeTool : workspaceMode === 'rigging' ? rigging.tool === tool.key : workspaceMode === 'shader' ? material.tool === tool.key : false;
        return (
          <button
            key={tool.key}
            className={isActive ? 'tool-btn active' : 'tool-btn'}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => {
              if (workspaceMode === 'draw') {
                dispatch({ type: 'set_active_tool', tool: tool.key });
              }
              if (workspaceMode === 'rigging') {
                dispatch({ type: 'rigging_set_tool', tool: tool.key });
              }
              if (workspaceMode === 'shader') {
                dispatch({ type: 'material_set_tool', tool: tool.key });
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
