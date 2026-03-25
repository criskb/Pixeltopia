import { useMemo, useState } from 'react';
import { EXPORT_FORMAT, SPRITESHEET_LAYOUT, defaultExportSettings, serializeProjectExport } from '@pixelforge/io';
import { useEditorState } from '../../state/EditorStateContext';

function toObjectUrl(bytes, mimeType) {
  const uint8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  return URL.createObjectURL(new Blob([uint8], { type: mimeType }));
}

function parseFrameTags(input) {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((tags, pair) => {
      const [key, ...rest] = pair.split(':');
      const index = Number(key.trim()) - 1;
      if (!Number.isInteger(index) || index < 0 || rest.length === 0) {
        return tags;
      }

      return { ...tags, [index]: rest.join(':').trim() || `frame-${index + 1}` };
    }, {});
}

async function requestServerExport(payload) {
  const response = await fetch('/api/v1/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Server export failed with status ${response.status}`);
  }

  return response.json();
}

export default function ExportModal({ open, onClose }) {
  const { project } = useEditorState();
  const [settings, setSettings] = useState(defaultExportSettings);
  const [frameTagsInput, setFrameTagsInput] = useState('1:idle');
  const [useServer, setUseServer] = useState(false);
  const [status, setStatus] = useState('');

  const payload = useMemo(() => ({
    ...settings,
    projectName: 'sprite_idle',
    frameTags: parseFrameTags(frameTagsInput)
  }), [settings, frameTagsInput]);

  if (!open) {
    return null;
  }

  const canSetColumns = settings.layout === SPRITESHEET_LAYOUT.GRID;

  const handleExport = async () => {
    setStatus('Exporting...');
    try {
      let result;
      if (useServer) {
        const serverResult = await requestServerExport({ project, settings: payload });
        result = {
          fileName: serverResult.fileName,
          mimeType: serverResult.mimeType,
          bytes: Uint8Array.from(atob(serverResult.base64), (ch) => ch.charCodeAt(0))
        };
      } else {
        result = serializeProjectExport(project, payload);
      }

      const url = toObjectUrl(result.bytes, result.mimeType);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${result.fileName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed');
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Export options">
      <section className="modal-card">
        <h2>Export Options</h2>

        <label className="control-row">
          <span>Format</span>
          <select value={settings.format} onChange={(event) => setSettings((prev) => ({ ...prev, format: event.target.value }))}>
            <option value={EXPORT_FORMAT.SINGLE_FRAME_PNG}>Single Frame PNG</option>
            <option value={EXPORT_FORMAT.SPRITESHEET_PNG}>Spritesheet PNG</option>
          </select>
        </label>

        <label className="control-row">
          <span>Frame Source</span>
          <select value={settings.frameSource} onChange={(event) => setSettings((prev) => ({ ...prev, frameSource: event.target.value }))}>
            <option value="selected">Selected Frame</option>
            <option value="all">All Frames</option>
          </select>
        </label>

        <label className="control-row">
          <span>Layout</span>
          <select value={settings.layout} onChange={(event) => setSettings((prev) => ({ ...prev, layout: event.target.value }))}>
            <option value={SPRITESHEET_LAYOUT.HORIZONTAL}>Horizontal</option>
            <option value={SPRITESHEET_LAYOUT.VERTICAL}>Vertical</option>
            <option value={SPRITESHEET_LAYOUT.GRID}>Grid</option>
          </select>
        </label>

        <label className="control-row">
          <span>Padding</span>
          <input type="number" min="0" value={settings.padding} onChange={(event) => setSettings((prev) => ({ ...prev, padding: Number(event.target.value) || 0 }))} />
        </label>

        <label className="control-row">
          <span>Columns</span>
          <input type="number" min="0" disabled={!canSetColumns} value={settings.columns} onChange={(event) => setSettings((prev) => ({ ...prev, columns: Number(event.target.value) || 0 }))} />
        </label>

        <label className="control-row">
          <span>Filename</span>
          <input value={settings.filenameTemplate} onChange={(event) => setSettings((prev) => ({ ...prev, filenameTemplate: event.target.value }))} />
        </label>

        <label className="control-row">
          <span>Frame Tags</span>
          <input value={frameTagsInput} onChange={(event) => setFrameTagsInput(event.target.value)} placeholder="1:idle,2:run" />
        </label>

        <label className="control-row checkbox-row">
          <input type="checkbox" checked={useServer} onChange={(event) => setUseServer(event.target.checked)} />
          <span>Use server endpoint (/api/v1/export)</span>
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleExport}>Export</button>
        </div>

        <p className="subhead">{status}</p>
      </section>
    </div>
  );
}
