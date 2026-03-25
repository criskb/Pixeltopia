import { Brush, Eraser, PaintBucket, Pipette, RectangleHorizontal, Lasso } from 'lucide-react';
import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

const tools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B', icon: Brush },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { key: 'fill', label: 'Fill', shortcut: 'G', icon: PaintBucket },
  { key: 'picker', label: 'Picker', shortcut: 'I', icon: Pipette },
  { key: 'select-rect', label: 'Rect', shortcut: 'M', icon: RectangleHorizontal },
  { key: 'select-lasso', label: 'Lasso', shortcut: 'L', icon: Lasso }
];

export default function ToolRail() {
  const { activeTool } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <aside className="tool-rail" aria-label="Tool rail">
      <div className="rail-title">Tools</div>
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.key}
            className={tool.key === activeTool ? 'tool-btn active' : 'tool-btn'}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => dispatch({ type: 'set_active_tool', tool: tool.key })}
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
