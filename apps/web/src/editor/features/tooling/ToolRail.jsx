import { useEditorDispatch, useEditorState } from '../../state/EditorStateContext';

const tools = [
  { key: 'pencil', label: 'Pencil', shortcut: 'B' },
  { key: 'eraser', label: 'Eraser', shortcut: 'E' },
  { key: 'fill', label: 'Fill', shortcut: 'G' },
  { key: 'picker', label: 'Picker', shortcut: 'I' },
  { key: 'select-rect', label: 'Sel Rect', shortcut: 'M' },
  { key: 'select-lasso', label: 'Lasso', shortcut: 'L' }
];

export default function ToolRail() {
  const { activeTool } = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <aside className="tool-rail" aria-label="Tool rail">
      {tools.map((tool) => (
        <button
          key={tool.key}
          className={tool.key === activeTool ? 'tool-btn active' : 'tool-btn'}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => dispatch({ type: 'set_active_tool', tool: tool.key })}
        >
          <span className="tool-name">{tool.label.slice(0, 2).toUpperCase()}</span>
          <span className="shortcut">{tool.shortcut}</span>
        </button>
      ))}
    </aside>
  );
}
