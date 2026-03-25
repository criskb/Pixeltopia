import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useEditorState } from '../../state/EditorStateContext';
import { renderCanvasBuffer } from '../../canvas/renderPipeline';

export default function ThreePreview() {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const { project, lighting } = useEditorState();

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

    const geometry = new THREE.PlaneGeometry(1.6, 1.6);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.05 });
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
      geometry.dispose();
      material.map?.dispose();
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
    rt.directional.position.set(Math.cos(angle), Math.sin(angle), 1.1);
    rt.directional.color = new THREE.Color(lighting.color ?? '#ffd38a');
    rt.directional.intensity = Math.max(0.05, lighting.enabled ? lighting.intensity ?? 0.7 : 0.05);
    rt.ambient.intensity = lighting.enabled ? lighting.ambient ?? 0.35 : 0.35;

    const composite = renderCanvasBuffer(project, null);
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
  }, [project, lighting]);

  return <div className="three-preview" ref={mountRef} aria-label="Three.js material and lighting preview" />;
}
