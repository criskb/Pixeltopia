import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { useEditorState } from '../../state/EditorStateContext';
import { renderCanvasBuffer } from '../../canvas/renderPipeline';

export default function ThreePreview() {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const { project, lighting, material } = useEditorState();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111624');

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 2.8);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(1, 1, 1);
    scene.add(directional);

    const geometry = new THREE.PlaneGeometry(1.6, 1.6, 96, 96);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const frame = () => {
      mesh.rotation.y += 0.0025;
      renderer.render(scene, camera);
      runtimeRef.current.animationId = requestAnimationFrame(frame);
    };

    runtimeRef.current = { renderer, scene, camera, ambient, directional, mesh, material, animationId: requestAnimationFrame(frame) };

    const onResize = () => {
      const rt = runtimeRef.current;
      if (!rt || !container) {
        return;
      }
      rt.camera.aspect = container.clientWidth / container.clientHeight;
      rt.camera.updateProjectionMatrix();
      rt.renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (runtimeRef.current?.animationId) {
        cancelAnimationFrame(runtimeRef.current.animationId);
      }
      runtimeRef.current?.environmentTexture?.dispose();
      geometry.dispose();
      material.map?.dispose();
      material.roughnessMap?.dispose();
      material.metalnessMap?.dispose();
      material.normalMap?.dispose();
      material.displacementMap?.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) {
      return;
    }

    const angle = (lighting.direction ?? 45) * (Math.PI / 180);
    if ((lighting.mode ?? 'point') === 'global') {
      rt.directional.position.set(Math.cos(angle), Math.sin(angle), 1.1);
    } else {
      const lightPos = lighting.position ?? { x: project.width * 0.75, y: project.height * 0.25 };
      const nx = (lightPos.x / Math.max(1, project.width)) * 2 - 1;
      const ny = -((lightPos.y / Math.max(1, project.height)) * 2 - 1);
      rt.directional.position.set(nx, ny, 1.1);
    }
    rt.directional.color = new THREE.Color(lighting.color ?? '#ffd38a');
    rt.directional.intensity = Math.max(0.05, lighting.enabled ? lighting.intensity ?? 0.7 : 0.05);
    rt.ambient.intensity = lighting.enabled ? lighting.ambient ?? 0.35 : 0.35;
    rt.material.envMapIntensity = lighting.hdriDataUrl ? (lighting.hdriStrength ?? 0.6) : 0;

    if (rt.environmentTexture) {
      rt.environmentTexture.dispose();
      rt.environmentTexture = null;
      rt.scene.environment = null;
    }
    if (lighting.hdriDataUrl) {
      const loader = lighting.hdriFormat === 'exr' ? new EXRLoader() : new THREE.TextureLoader();
      loader.load(lighting.hdriDataUrl, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        if (lighting.hdriFormat !== 'exr') {
          texture.colorSpace = THREE.SRGBColorSpace;
        }
        rt.environmentTexture = texture;
        rt.scene.environment = texture;
      });
    }

    const composite = renderCanvasBuffer(project, null, null, material);
    const data = new Uint8Array(composite.data);
    const texture = new THREE.DataTexture(data, composite.width, composite.height, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    if (rt.material.map) {
      rt.material.map.dispose();
    }

    rt.material.map = texture;
    rt.material.needsUpdate = true;

    const buildGrayTexture = (mask, strength = 1) => {
      const gray = new Uint8Array(composite.width * composite.height * 4);
      for (let i = 0; i < composite.width * composite.height; i += 1) {
        const normalized = (mask?.[i] ?? 0) / 255;
        const value = Math.round(255 * Math.max(0, Math.min(1, normalized * strength)));
        const p = i * 4;
        gray[p] = value;
        gray[p + 1] = value;
        gray[p + 2] = value;
        gray[p + 3] = 255;
      }
      const tex = new THREE.DataTexture(gray, composite.width, composite.height, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    const buildHeightTexture = () => {
      const heightData = new Uint8Array(composite.width * composite.height * 4);
      for (let i = 0; i < composite.width * composite.height; i += 1) {
        const p = i * 4;
        const luminance = (
          0.2126 * composite.data[p]
          + 0.7152 * composite.data[p + 1]
          + 0.0722 * composite.data[p + 2]
        ) / 255;
        const fromMask = (material.heightMask?.[i] ?? 0) / 255;
        const combined = Math.max(0, Math.min(1, (luminance * 0.45) + (fromMask * (material.heightStrength ?? 0.35))));
        const value = Math.round(combined * 255);
        heightData[p] = value;
        heightData[p + 1] = value;
        heightData[p + 2] = value;
        heightData[p + 3] = 255;
      }
      const tex = new THREE.DataTexture(heightData, composite.width, composite.height, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      return { tex, heightData };
    };

    const buildNormalTexture = (heightData) => {
      const normal = new Uint8Array(composite.width * composite.height * 4);
      const strength = Math.max(0, material.normalStrength ?? 0.8);
      const width = composite.width;
      const height = composite.height;
      const getHeight = (x, y) => {
        const clampedX = Math.max(0, Math.min(width - 1, x));
        const clampedY = Math.max(0, Math.min(height - 1, y));
        return heightData[(clampedY * width + clampedX) * 4] / 255;
      };
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const left = getHeight(x - 1, y);
          const right = getHeight(x + 1, y);
          const up = getHeight(x, y - 1);
          const down = getHeight(x, y + 1);
          const dx = (right - left) * strength;
          const dy = (down - up) * strength;
          const nx = -dx;
          const ny = -dy;
          const nz = 1;
          const len = Math.max(0.00001, Math.hypot(nx, ny, nz));
          const px = (y * width + x) * 4;
          normal[px] = Math.round((((nx / len) * 0.5) + 0.5) * 255);
          normal[px + 1] = Math.round((((ny / len) * 0.5) + 0.5) * 255);
          normal[px + 2] = Math.round((((nz / len) * 0.5) + 0.5) * 255);
          normal[px + 3] = 255;
        }
      }
      const tex = new THREE.DataTexture(normal, composite.width, composite.height, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    if (rt.material.roughnessMap) {
      rt.material.roughnessMap.dispose();
    }
    if (rt.material.metalnessMap) {
      rt.material.metalnessMap.dispose();
    }
    if (rt.material.normalMap) {
      rt.material.normalMap.dispose();
    }
    if (rt.material.displacementMap) {
      rt.material.displacementMap.dispose();
    }

    rt.material.roughnessMap = buildGrayTexture(material.roughnessMask, material.roughnessStrength ?? 0.6);
    rt.material.metalnessMap = buildGrayTexture(material.metalnessMask, material.metalnessStrength ?? 0.35);
    const { tex: heightTexture, heightData } = buildHeightTexture();
    rt.material.displacementMap = heightTexture;
    rt.material.displacementScale = Math.max(0, material.heightStrength ?? 0.35) * 0.25;
    rt.material.normalMap = buildNormalTexture(heightData);
    rt.material.roughness = 1;
    rt.material.metalness = 1;
    rt.material.needsUpdate = true;
  }, [project, lighting, material]);

  return <div className="three-preview" ref={mountRef} aria-label="Three.js material and lighting preview" />;
}
