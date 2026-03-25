export const EXPORT_FORMAT = {
  SINGLE_FRAME_PNG: 'single_frame_png',
  SPRITESHEET_PNG: 'spritesheet_png'
};

export const SPRITESHEET_LAYOUT = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  GRID: 'grid'
};

export const defaultExportSettings = {
  format: EXPORT_FORMAT.SINGLE_FRAME_PNG,
  frameSource: 'selected',
  layout: SPRITESHEET_LAYOUT.HORIZONTAL,
  columns: 0,
  padding: 0,
  frameTags: {},
  filenameTemplate: '{project}-{format}-{frameTag}',
  projectName: 'sprite'
};

export function resolveExportSettings(overrides = {}) {
  const settings = {
    ...defaultExportSettings,
    ...overrides,
    frameTags: { ...defaultExportSettings.frameTags, ...(overrides.frameTags ?? {}) }
  };

  if (!Object.values(EXPORT_FORMAT).includes(settings.format)) {
    throw new Error(`Unsupported export format: ${settings.format}`);
  }

  if (!Object.values(SPRITESHEET_LAYOUT).includes(settings.layout)) {
    throw new Error(`Unsupported spritesheet layout: ${settings.layout}`);
  }

  if (!Number.isInteger(settings.padding) || settings.padding < 0) {
    throw new Error('Export padding must be a non-negative integer');
  }

  if (!Number.isInteger(settings.columns) || settings.columns < 0) {
    throw new Error('Export columns must be a non-negative integer');
  }

  if (!settings.filenameTemplate || typeof settings.filenameTemplate !== 'string') {
    throw new Error('filenameTemplate is required');
  }

  return settings;
}

export function buildFileName(template, context) {
  const safe = {
    project: sanitize(context.project ?? 'sprite'),
    format: sanitize(context.format ?? 'export'),
    frameTag: sanitize(context.frameTag ?? 'frame'),
    frameIndex: String(context.frameIndex ?? 1)
  };

  const rendered = template
    .replaceAll('{project}', safe.project)
    .replaceAll('{format}', safe.format)
    .replaceAll('{frameTag}', safe.frameTag)
    .replaceAll('{frameIndex}', safe.frameIndex)
    .replace(/\s+/g, '_');

  return rendered || 'sprite-export';
}

function sanitize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}
