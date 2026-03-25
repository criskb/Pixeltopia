import { buildFileName, EXPORT_FORMAT, resolveExportSettings, SPRITESHEET_LAYOUT } from './settings.js';

function compositeFrame(project, frame) {
  const data = new Uint8ClampedArray(project.width * project.height * 4);

  for (const layer of project.layers) {
    if (!layer.visible) {
      continue;
    }

    const cel = frame.cels[layer.id];
    if (!cel) {
      continue;
    }

    for (let i = 0; i < data.length; i += 4) {
      const srcAlpha = cel.pixelBuffer.data[i + 3] / 255;
      if (srcAlpha <= 0) {
        continue;
      }

      const dstAlpha = data[i + 3] / 255;
      const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

      data[i] = Math.round((cel.pixelBuffer.data[i] * srcAlpha + data[i] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      data[i + 1] = Math.round((cel.pixelBuffer.data[i + 1] * srcAlpha + data[i + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      data[i + 2] = Math.round((cel.pixelBuffer.data[i + 2] * srcAlpha + data[i + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      data[i + 3] = Math.round(outAlpha * 255);
    }
  }

  return { width: project.width, height: project.height, data };
}

function resolveFrames(project, settings) {
  if (settings.frameSource === 'all') {
    return project.frames;
  }

  const selected = project.frames.find((frame) => frame.id === project.selectedFrameId);
  return selected ? [selected] : [project.frames[0]];
}

function spritesheetGeometry(frameWidth, frameHeight, frameCount, settings) {
  const padding = settings.padding;
  if (settings.layout === SPRITESHEET_LAYOUT.VERTICAL) {
    return {
      columns: 1,
      rows: frameCount,
      width: frameWidth,
      height: frameHeight * frameCount + padding * Math.max(0, frameCount - 1)
    };
  }

  if (settings.layout === SPRITESHEET_LAYOUT.GRID) {
    const columns = Math.max(1, settings.columns || Math.ceil(Math.sqrt(frameCount)));
    const rows = Math.ceil(frameCount / columns);
    return {
      columns,
      rows,
      width: frameWidth * columns + padding * Math.max(0, columns - 1),
      height: frameHeight * rows + padding * Math.max(0, rows - 1)
    };
  }

  return {
    columns: frameCount,
    rows: 1,
    width: frameWidth * frameCount + padding * Math.max(0, frameCount - 1),
    height: frameHeight
  };
}

function buildSpritesheet(buffers, settings) {
  const geometry = spritesheetGeometry(buffers[0].width, buffers[0].height, buffers.length, settings);
  const output = new Uint8ClampedArray(geometry.width * geometry.height * 4);

  for (let frameIndex = 0; frameIndex < buffers.length; frameIndex += 1) {
    const column = frameIndex % geometry.columns;
    const row = Math.floor(frameIndex / geometry.columns);
    const startX = column * (buffers[frameIndex].width + settings.padding);
    const startY = row * (buffers[frameIndex].height + settings.padding);

    for (let y = 0; y < buffers[frameIndex].height; y += 1) {
      for (let x = 0; x < buffers[frameIndex].width; x += 1) {
        const srcIndex = (y * buffers[frameIndex].width + x) * 4;
        const dstIndex = ((startY + y) * geometry.width + startX + x) * 4;
        output[dstIndex] = buffers[frameIndex].data[srcIndex];
        output[dstIndex + 1] = buffers[frameIndex].data[srcIndex + 1];
        output[dstIndex + 2] = buffers[frameIndex].data[srcIndex + 2];
        output[dstIndex + 3] = buffers[frameIndex].data[srcIndex + 3];
      }
    }
  }

  return { width: geometry.width, height: geometry.height, data: output };
}

function encodePng(buffer) {
  const canvas = document.createElement('canvas');
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(buffer.data, buffer.width, buffer.height);
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG in browser'));
        return;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      resolve(bytes);
    }, 'image/png');
  });
}

export async function serializeProjectExport(project, options = {}) {
  const settings = resolveExportSettings(options);
  const frames = resolveFrames(project, settings);
  const flattenedFrames = frames.map((frame) => compositeFrame(project, frame));

  if (settings.format === EXPORT_FORMAT.SINGLE_FRAME_PNG) {
    const frame = flattenedFrames[0];
    return {
      fileName: `${buildFileName(settings.filenameTemplate, {
        project: settings.projectName,
        format: 'png',
        frameTag: settings.frameTags[0] ?? frames[0]?.id ?? 'frame',
        frameIndex: 1
      })}.png`,
      mimeType: 'image/png',
      width: frame.width,
      height: frame.height,
      bytes: await encodePng(frame)
    };
  }

  const sheet = buildSpritesheet(flattenedFrames, settings);
  return {
    fileName: `${buildFileName(settings.filenameTemplate, {
      project: settings.projectName,
      format: 'spritesheet',
      frameTag: 'all',
      frameIndex: 1
    })}.png`,
    mimeType: 'image/png',
    width: sheet.width,
    height: sheet.height,
    bytes: await encodePng(sheet)
  };
}

export * from './settings.js';
