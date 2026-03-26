import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { useEditorState } from '../../state/EditorStateContext';
import { renderCanvasBuffer } from '../../canvas/renderPipeline';
import {
  buildDepthTextureData,
  buildGrayscaleTextureData,
  buildHeightTextureData,
  buildNormalTextureData
} from './materialMaps';

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

    const makeTexture = (sourceData, colorSpace = THREE.NoColorSpace) => {
      const tex = new THREE.DataTexture(sourceData, composite.width, composite.height, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = colorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    const buildGrayTexture = (mask, strength = 1) => {
      const gray = buildGrayscaleTextureData(mask, composite.width, composite.height, strength);
      return makeTexture(gray, THREE.NoColorSpace);
    };

    const heightData = buildHeightTextureData(composite, material.heightMask, material.heightStrength ?? 0.35);
    const normalData = buildNormalTextureData(heightData, composite.width, composite.height, Math.max(0, material.normalStrength ?? 0.8));
    const depthData = buildDepthTextureData(heightData);

    const buildHeightTexture = () => {
      return { tex: makeTexture(heightData, THREE.NoColorSpace), heightData };
    };

    const buildNormalTexture = () => {
      return makeTexture(normalData, THREE.NoColorSpace);
    };

    const buildDepthTexture = () => {
      return makeTexture(depthData, THREE.NoColorSpace);
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

    const roughnessTexture = buildGrayTexture(material.roughnessMask, material.roughnessStrength ?? 0.6);
    const metalnessTexture = buildGrayTexture(material.metalnessMask, material.metalnessStrength ?? 0.35);
    const { tex: heightTexture } = buildHeightTexture();
    const normalTexture = buildNormalTexture();

    rt.material.roughnessMap = roughnessTexture;
    rt.material.metalnessMap = metalnessTexture;
    rt.material.displacementMap = heightTexture;
    rt.material.displacementScale = Math.max(0, material.heightStrength ?? 0.35) * 0.25;
    rt.material.normalMap = normalTexture;
    rt.material.roughness = 1;
    rt.material.metalness = 1;
    rt.material.envMapIntensity = lighting.hdriDataUrl ? (lighting.hdriStrength ?? 0.6) : 0;

    if ((material.previewMode ?? 'lit') !== 'lit') {
      if (rt.material.map) {
        rt.material.map.dispose();
      }
      switch (material.previewMode) {
        case 'roughness':
          rt.material.map = buildGrayTexture(material.roughnessMask, material.roughnessStrength ?? 0.6);
          break;
        case 'metalness':
          rt.material.map = buildGrayTexture(material.metalnessMask, material.metalnessStrength ?? 0.35);
          break;
        case 'height':
          rt.material.map = makeTexture(heightData, THREE.NoColorSpace);
          break;
        case 'normal':
          rt.material.map = makeTexture(normalData, THREE.NoColorSpace);
          break;
        case 'depth':
          rt.material.map = buildDepthTexture();
          break;
        default:
          rt.material.map = texture;
      }
      rt.material.normalMap = null;
      rt.material.displacementMap = null;
      rt.material.displacementScale = 0;
      rt.material.roughness = 1;
      rt.material.metalness = 0;
      rt.material.envMapIntensity = 0;
      rt.scene.environment = null;
    } else {
      rt.material.map = texture;
    }

    rt.material.needsUpdate = true;
  }, [project, lighting, material]);

  return <div className="three-preview" ref={mountRef} aria-label="Three.js material and lighting preview" />;
}
