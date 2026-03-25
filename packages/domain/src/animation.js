function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clonePixelBuffer(pixelBuffer) {
  return {
    width: pixelBuffer.width,
    height: pixelBuffer.height,
    data: new Uint8ClampedArray(pixelBuffer.data)
  };
}

export function createCel({ layerId, pixelBuffer }) {
  return { id: uid('cel'), layerId, pixelBuffer };
}

export function createFrame({ duration = 1, cels = {} } = {}) {
  return { id: uid('frame'), duration, cels };
}

export function createLayer({ name, visible = true, locked = false } = {}) {
  return { id: uid('layer'), name, visible, locked };
}

export function createProject({ width, height, layerNames = ['Line Art', 'Base Colors', 'Background'], frameCount = 4, fps = 12, loopMode = 'loop', createPixelBuffer }) {
  const layers = layerNames.map((name) => createLayer({ name }));
  const frames = Array.from({ length: frameCount }, () => createFrame({
    cels: Object.fromEntries(layers.map((layer) => [layer.id, createCel({ layerId: layer.id, pixelBuffer: createPixelBuffer(width, height) })]))
  }));

  return {
    width,
    height,
    layers,
    frames,
    selectedLayerId: layers[0]?.id,
    selectedFrameId: frames[0]?.id,
    playback: { fps, isPlaying: false, playheadFrameId: frames[0]?.id, loopMode },
    onionSkin: { enabled: true, previous: 1, next: 1, opacity: 0.35 }
  };
}

export function getFrameIndex(project, frameId = project.selectedFrameId) {
  return project.frames.findIndex((frame) => frame.id === frameId);
}

export function getSelectedFrame(project) {
  return project.frames[getFrameIndex(project)] ?? project.frames[0];
}

export function getSelectedCel(project) {
  return getSelectedFrame(project)?.cels[project.selectedLayerId];
}

export function selectFrame(project, frameId) {
  return { ...project, selectedFrameId: frameId, playback: { ...project.playback, playheadFrameId: frameId } };
}

function duplicateFrameRecord(frame) {
  return {
    ...frame,
    id: uid('frame'),
    cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => [layerId, {
      ...cel,
      id: uid('cel'),
      pixelBuffer: clonePixelBuffer(cel.pixelBuffer)
    }]))
  };
}

export function createFrameAfter(project, sourceFrameId = project.selectedFrameId) {
  const index = Math.max(0, getFrameIndex(project, sourceFrameId));
  const source = project.frames[index] ?? project.frames[0];
  const frame = createFrame({
    cels: Object.fromEntries(Object.entries(source.cels).map(([layerId, cel]) => [layerId, createCel({ layerId, pixelBuffer: clonePixelBuffer(cel.pixelBuffer) })]))
  });
  const frames = [...project.frames.slice(0, index + 1), frame, ...project.frames.slice(index + 1)];
  return selectFrame({ ...project, frames }, frame.id);
}

export function duplicateFrame(project, frameId = project.selectedFrameId) {
  const index = Math.max(0, getFrameIndex(project, frameId));
  const source = project.frames[index] ?? project.frames[0];
  const frame = duplicateFrameRecord(source);
  const frames = [...project.frames.slice(0, index + 1), frame, ...project.frames.slice(index + 1)];
  return selectFrame({ ...project, frames }, frame.id);
}

export function deleteFrame(project, frameId = project.selectedFrameId) {
  if (project.frames.length <= 1) {
    return project;
  }

  const index = Math.max(0, getFrameIndex(project, frameId));
  const frames = project.frames.filter((frame) => frame.id !== frameId);
  const nextFrameId = frames[Math.max(0, index - 1)]?.id ?? frames[0].id;
  return selectFrame({ ...project, frames }, nextFrameId);
}

export function updateCelPixelBuffer(project, { frameId = project.selectedFrameId, layerId = project.selectedLayerId, pixelBuffer }) {
  return {
    ...project,
    frames: project.frames.map((frame) => frame.id !== frameId
      ? frame
      : { ...frame, cels: { ...frame.cels, [layerId]: { ...frame.cels[layerId], pixelBuffer } } })
  };
}

export function toggleLayerVisibility(project, layerId) {
  return { ...project, layers: project.layers.map((layer) => layer.id === layerId ? { ...layer, visible: !layer.visible } : layer) };
}

export function toggleLayerLock(project, layerId) {
  return { ...project, layers: project.layers.map((layer) => layer.id === layerId ? { ...layer, locked: !layer.locked } : layer) };
}

export function selectLayer(project, layerId) {
  return { ...project, selectedLayerId: layerId };
}

export function setPlayback(project, updates) {
  return { ...project, playback: { ...project.playback, ...updates } };
}

export function advancePlayhead(project, step = 1) {
  const index = Math.max(0, getFrameIndex(project, project.playback.playheadFrameId));
  const rawIndex = index + step;
  const resolvedIndex = project.playback.loopMode === 'loop'
    ? ((rawIndex % project.frames.length) + project.frames.length) % project.frames.length
    : Math.min(Math.max(rawIndex, 0), project.frames.length - 1);

  return setPlayback(project, { playheadFrameId: project.frames[resolvedIndex].id });
}

export function setOnionSkin(project, updates) {
  return { ...project, onionSkin: { ...project.onionSkin, ...updates } };
}

export function getOnionFrames(project) {
  const index = Math.max(0, getFrameIndex(project));
  const previous = [];
  const next = [];

  for (let i = 1; i <= project.onionSkin.previous; i += 1) {
    if (project.frames[index - i]) {
      previous.push(project.frames[index - i].id);
    }
  }

  for (let i = 1; i <= project.onionSkin.next; i += 1) {
    if (project.frames[index + i]) {
      next.push(project.frames[index + i].id);
    }
  }

  return { previous, next };
}
