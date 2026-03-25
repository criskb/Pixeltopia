import { createPixelBuffer } from './pixelBuffer';
import { getOnionFrames } from '@pixelforge/domain';

function blendChannels(dst, src, mode) {
  switch (mode) {
    case 'multiply':
      return [(src[0] * dst[0]) / 255, (src[1] * dst[1]) / 255, (src[2] * dst[2]) / 255];
    case 'screen':
      return [
        255 - ((255 - src[0]) * (255 - dst[0])) / 255,
        255 - ((255 - src[1]) * (255 - dst[1])) / 255,
        255 - ((255 - src[2]) * (255 - dst[2])) / 255
      ];
    case 'add':
      return [Math.min(255, src[0] + dst[0]), Math.min(255, src[1] + dst[1]), Math.min(255, src[2] + dst[2])];
    default:
      return [src[0], src[1], src[2]];
  }
}

function blendPixel(dst, src, opacity = 1, mode = 'normal') {
  const srcAlpha = (src[3] / 255) * opacity;
  if (srcAlpha <= 0) {
    return dst;
  }

  const dstAlpha = dst[3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) {
    return [0, 0, 0, 0];
  }

  const blendedRgb = blendChannels(dst, src, mode);
  return [
    Math.round((blendedRgb[0] * srcAlpha + dst[0] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round((blendedRgb[1] * srcAlpha + dst[1] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round((blendedRgb[2] * srcAlpha + dst[2] * dstAlpha * (1 - srcAlpha)) / outAlpha),
    Math.round(outAlpha * 255)
  ];
}


function applyRiggingToFrame(frame, project, rigging, frameId) {
  if (!rigging?.enabled || !rigging?.weights) {
    return frame;
  }

  const keyframe = rigging.keyframes?.[frameId];
  if (!keyframe) {
    return frame;
  }

  const deformed = {
    ...frame,
    cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => {
      const nextData = new Uint8ClampedArray(cel.pixelBuffer.data);
      const baseData = new Uint8ClampedArray(cel.pixelBuffer.data);

      for (const bone of rigging.bones) {
        const mask = rigging.weights[bone.id];
        const offset = keyframe[bone.id];
        if (!mask || !offset) {
          continue;
        }

        const dx = Math.round(offset.dx ?? 0);
        const dy = Math.round(offset.dy ?? 0);

        for (let y = 0; y < project.height; y += 1) {
          for (let x = 0; x < project.width; x += 1) {
            const idx = y * project.width + x;
            if (!mask[idx]) {
              continue;
            }

            const srcX = x - dx;
            const srcY = y - dy;
            const dstPixel = idx * 4;
            if (srcX < 0 || srcY < 0 || srcX >= project.width || srcY >= project.height) {
              nextData[dstPixel] = 0;
              nextData[dstPixel + 1] = 0;
              nextData[dstPixel + 2] = 0;
              nextData[dstPixel + 3] = 0;
              continue;
            }

            const srcPixel = (srcY * project.width + srcX) * 4;
            nextData[dstPixel] = baseData[srcPixel];
            nextData[dstPixel + 1] = baseData[srcPixel + 1];
            nextData[dstPixel + 2] = baseData[srcPixel + 2];
            nextData[dstPixel + 3] = baseData[srcPixel + 3];
          }
        }
      }

      return [layerId, {
        ...cel,
        pixelBuffer: {
          ...cel.pixelBuffer,
          data: nextData
        }
      }];
    }))
  };

  return deformed;
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
      const src = [cel.pixelBuffer.data[i], cel.pixelBuffer.data[i + 1], cel.pixelBuffer.data[i + 2], cel.pixelBuffer.data[i + 3]];
      const blended = blendPixel(dst, src, opacity * (layer.opacity ?? 1), layer.blendMode ?? 'normal');
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


function applyMaterialChannels(buffer, material) {
  if (!material) {
    return buffer;
  }

  const out = {
    width: buffer.width,
    height: buffer.height,
    data: new Uint8ClampedArray(buffer.data)
  };

  const emissiveStrength = Math.max(0, Math.min(1, material.emissiveStrength ?? 0.6));
  const roughnessStrength = Math.max(0, Math.min(1, material.roughnessStrength ?? 0.6));
  const metalnessStrength = Math.max(0, Math.min(1, material.metalnessStrength ?? 0.35));

  for (let i = 0; i < out.width * out.height; i += 1) {
    const px = i * 4;
    if (material.emissiveMask?.[i]) {
      out.data[px] = Math.min(255, out.data[px] + 255 * emissiveStrength * 0.35);
      out.data[px + 1] = Math.min(255, out.data[px + 1] + 80 * emissiveStrength);
      out.data[px + 2] = Math.min(255, out.data[px + 2] + 255 * emissiveStrength);
    }

    if (material.roughnessMask?.[i]) {
      const rough = 1 - 0.22 * roughnessStrength;
      out.data[px] = Math.round(out.data[px] * rough);
      out.data[px + 1] = Math.round(out.data[px + 1] * rough);
      out.data[px + 2] = Math.round(out.data[px + 2] * rough);
    }

    if (material.metalnessMask?.[i]) {
      out.data[px] = Math.min(255, out.data[px] + 35 * metalnessStrength);
      out.data[px + 1] = Math.min(255, out.data[px + 1] + 35 * metalnessStrength);
      out.data[px + 2] = Math.min(255, out.data[px + 2] + 45 * metalnessStrength);
    }
  }

  return out;
}

function applyLighting(buffer, lighting) {
  if (!lighting?.enabled) {
    return buffer;
  }

  const lit = {
    width: buffer.width,
    height: buffer.height,
    data: new Uint8ClampedArray(buffer.data)
  };

  const radians = (lighting.direction ?? 45) * (Math.PI / 180);
  const lightVector = { x: Math.cos(radians), y: Math.sin(radians) };
  const intensity = Math.max(0, Math.min(1, lighting.intensity ?? 0.7));
  const ambient = Math.max(0, Math.min(1, lighting.ambient ?? 0.3));
  const mode = lighting.mode ?? 'point';
  const lightPosition = lighting.position ?? { x: Math.round(lit.width * 0.75), y: Math.round(lit.height * 0.25) };
  const hdriSamples = Array.isArray(lighting.hdriSamples) ? lighting.hdriSamples : null;
  const hdriStrength = Math.max(0, Math.min(1, lighting.hdriStrength ?? 0.6));
  const lightTint = lighting.color ?? '#ffd38a';
  const tint = [
    Number.parseInt(lightTint.slice(1, 3), 16),
    Number.parseInt(lightTint.slice(3, 5), 16),
    Number.parseInt(lightTint.slice(5, 7), 16)
  ];

  for (let y = 1; y < lit.height - 1; y += 1) {
    for (let x = 1; x < lit.width - 1; x += 1) {
      const i = (y * lit.width + x) * 4;
      const a = lit.data[i + 3] / 255;
      if (a <= 0) {
        continue;
      }

      const leftA = lit.data[(y * lit.width + (x - 1)) * 4 + 3] / 255;
      const rightA = lit.data[(y * lit.width + (x + 1)) * 4 + 3] / 255;
      const upA = lit.data[((y - 1) * lit.width + x) * 4 + 3] / 255;
      const downA = lit.data[((y + 1) * lit.width + x) * 4 + 3] / 255;

      const normalX = rightA - leftA;
      const normalY = downA - upA;
      let shade = 0;
      if (mode === 'global') {
        shade = Math.max(0, (normalX * lightVector.x + normalY * lightVector.y + 1) / 2);
      } else {
        const toLightX = lightPosition.x - x;
        const toLightY = lightPosition.y - y;
        const dist = Math.hypot(toLightX, toLightY);
        const invDist = 1 / Math.max(1, dist);
        const lx = toLightX * invDist;
        const ly = toLightY * invDist;
        const nLen = Math.max(0.0001, Math.hypot(normalX, normalY));
        const nx = normalX / nLen;
        const ny = normalY / nLen;
        const diffuse = Math.max(0, (nx * lx + ny * ly + 1) / 2);
        const attenuation = 1 - Math.min(1, dist / Math.max(lit.width, lit.height));
        shade = diffuse * (0.35 + attenuation * 0.65);
      }
      const energy = ambient + intensity * shade;
      let envTint = tint;
      if (hdriSamples?.length) {
        const refX = mode === 'global' ? lightVector.x : (lightPosition.x - x);
        const refY = mode === 'global' ? lightVector.y : (lightPosition.y - y);
        const envAngle = (Math.atan2(normalY + refY, normalX + refX) + Math.PI) / (Math.PI * 2);
        const sampleIndex = Math.floor(envAngle * hdriSamples.length) % hdriSamples.length;
        envTint = hdriSamples[sampleIndex] ?? tint;
      }
      const mixedTint = [
        tint[0] * (1 - hdriStrength) + envTint[0] * hdriStrength,
        tint[1] * (1 - hdriStrength) + envTint[1] * hdriStrength,
        tint[2] * (1 - hdriStrength) + envTint[2] * hdriStrength
      ];

      lit.data[i] = Math.min(255, lit.data[i] * energy + mixedTint[0] * 0.18 * intensity);
      lit.data[i + 1] = Math.min(255, lit.data[i + 1] * energy + mixedTint[1] * 0.18 * intensity);
      lit.data[i + 2] = Math.min(255, lit.data[i + 2] * energy + mixedTint[2] * 0.18 * intensity);
    }
  }

  return lit;
}

export function compositeProjectFrame(project, frameId, opacity = 1, rigging = null) {
  const frame = project.frames.find((item) => item.id === frameId);
  if (!frame) {
    return createPixelBuffer(project.width, project.height);
  }

  const riggedFrame = applyRiggingToFrame(frame, project, rigging, frameId);
  return compositeFrame(riggedFrame, project.layers, project.width, project.height, opacity);
}

export function renderCanvasBuffer(project, lighting = null, rigging = null, material = null) {
  const finalBuffer = createPixelBuffer(project.width, project.height);

  if (project.onionSkin.enabled) {
    const { previous, next } = getOnionFrames(project);

    for (const frameId of previous) {
      compositeInto(finalBuffer, compositeProjectFrame(project, frameId, project.onionSkin.opacity, rigging));
    }

    for (const frameId of next) {
      compositeInto(finalBuffer, compositeProjectFrame(project, frameId, project.onionSkin.opacity, rigging));
    }
  }

  compositeInto(finalBuffer, compositeProjectFrame(project, project.selectedFrameId, 1, rigging));
  const materialBuffer = applyMaterialChannels(finalBuffer, material);
  return applyLighting(materialBuffer, lighting);
}

export function renderWrapPreviewBuffer(buffer, offset = { x: 0, y: 0 }) {
  const result = createPixelBuffer(buffer.width * 3, buffer.height * 3);
  const offsetX = ((offset.x % buffer.width) + buffer.width) % buffer.width;
  const offsetY = ((offset.y % buffer.height) + buffer.height) % buffer.height;

  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const srcX = ((x - offsetX) % buffer.width + buffer.width) % buffer.width;
      const srcY = ((y - offsetY) % buffer.height + buffer.height) % buffer.height;
      const dstIndex = (y * result.width + x) * 4;
      const srcIndex = (srcY * buffer.width + srcX) * 4;
      result.data[dstIndex] = buffer.data[srcIndex];
      result.data[dstIndex + 1] = buffer.data[srcIndex + 1];
      result.data[dstIndex + 2] = buffer.data[srcIndex + 2];
      result.data[dstIndex + 3] = buffer.data[srcIndex + 3];
    }
  }

  return result;
}
