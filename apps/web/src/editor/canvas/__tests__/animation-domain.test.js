import { describe, expect, it } from 'vitest';
import { advancePlayhead, createProject, createFrameAfter, deleteFrame, duplicateFrame, selectFrame } from '@pixelforge/domain';
import { createPixelBuffer } from '../pixelBuffer';

describe('animation domain frame navigation', () => {
  it('creates, duplicates, deletes, and selects frames', () => {
    let project = createProject({ width: 4, height: 4, frameCount: 2, createPixelBuffer });

    const originalCount = project.frames.length;
    project = createFrameAfter(project);
    expect(project.frames.length).toBe(originalCount + 1);

    const selectedAfterCreate = project.selectedFrameId;
    project = duplicateFrame(project);
    expect(project.frames.length).toBe(originalCount + 2);
    expect(project.selectedFrameId).not.toBe(selectedAfterCreate);

    const selectedFrameId = project.selectedFrameId;
    project = deleteFrame(project, selectedFrameId);
    expect(project.frames.length).toBe(originalCount + 1);

    const targetFrame = project.frames[0].id;
    project = selectFrame(project, targetFrame);
    expect(project.selectedFrameId).toBe(targetFrame);
  });

  it('advances playhead with loop mode', () => {
    let project = createProject({ width: 2, height: 2, frameCount: 3, createPixelBuffer });
    project = selectFrame(project, project.frames[2].id);
    project = advancePlayhead(project, 1);
    expect(project.playback.playheadFrameId).toBe(project.frames[0].id);
  });
});
