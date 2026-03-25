import { createPixelBuffer } from './pixelBuffer';
import { getOnionFrames } from '@pixelforge/domain';

function blendPixel(dst, src, opacity = 1) {
  const srcAlpha = (src[3] / 255) * opacity;
  if (srcAlpha <= 0) {
    return dst;
  }

  const dstAlpha = dst[3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) {
    return [0, 0, 0, 0];
  }

  return [
    Math.round((src[0] * srcAlpha + dst[0] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round((src[1] * srcAlpha + dst[1] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round((src[2] * srcAlpha + dst[2] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round(outAlpha * 255)
  ];
}

function compositeFrame(frame, layers, width, height, opacity = 1) {
  const result = createPixelBuffer(width, height);

  for (const layer of layers) {
    if (!layer.visible) {
      continue;
    }

    const cel = frame.cels[layer.id];
    if (!cel) {
      continue;
    }

    for (let i = 0; i < result.data.length; i += 4) {
      const dst = [result.data[i], result.data[i + 1], result.data[i + 2], result.data[i + 3]];
      const src = [
        cel.pixelBuffer.data[i],
        cel.pixelBuffer.data[i + 1],
        cel.pixelBuffer.data[i + 2],
        cel.pixelBuffer.data[i + 3]
      ];
      const blended = blendPixel(dst, src, opacity);
      result.data[i] = blended[0];
      result.data[i + 1] = blended[1];
      result.data[i + 2] = blended[2];
      result.data[i + 3] = blended[3];
    }
  }

  return result;
}

function compositeInto(base, overlay) {
  for (let i = 0; i < base.data.length; i += 4) {
    const blended = blendPixel(
      [base.data[i], base.data[i + 1], base.data[i + 2], base.data[i + 3]],
      [overlay.data[i], overlay.data[i + 1], overlay.data[i + 2], overlay.data[i + 3]],
      1
    );
    base.data[i] = blended[0];
    base.data[i + 1] = blended[1];
    base.data[i + 2] = blended[2];
    base.data[i + 3] = blended[3];
  }
}

export function compositeProjectFrame(project, frameId, opacity = 1) {
  const frame = project.frames.find((item) => item.id === frameId);
  if (!frame) {
    return createPixelBuffer(project.width, project.height);
  }

  return compositeFrame(frame, project.layers, project.width, project.height, opacity);
}

export function renderCanvasBuffer(project) {
  const finalBuffer = createPixelBuffer(project.width, project.height);

  if (project.onionSkin.enabled) {
    const { previous, next } = getOnionFrames(project);

    for (const frameId of previous) {
      compositeInto(finalBuffer, compositeProjectFrame(project, frameId, project.onionSkin.opacity));
    }

    for (const frameId of next) {
      compositeInto(finalBuffer, compositeProjectFrame(project, frameId, project.onionSkin.opacity));
    }
  }

  compositeInto(finalBuffer, compositeProjectFrame(project, project.selectedFrameId, 1));
  return finalBuffer;
}
