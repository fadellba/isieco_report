import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { CartePoint } from '@isieco/shared';

interface DakarScene3DProps {
  points: CartePoint[];
  selectedPoint: CartePoint | null;
  onSelect: (point: CartePoint) => void;
}

const TYPE_COLORS: Record<CartePoint['typeObjet'], number> = {
  SIGNALEMENT: 0xf5a64a,
  DOSSIER: 0x48d391,
  INTERVENTION: 0xa78bfa,
};

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export const DakarScene3D: React.FC<DakarScene3DProps> = ({
  points,
  selectedPoint,
  onSelect,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const selectedPointRef = useRef(selectedPoint);
  const markerStateRef = useRef<Array<{ point: CartePoint; x: number; z: number; index: number }>>([]);
  const markerMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const haloMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const zoomRef = useRef<((direction: number) => void) | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedPointRef.current = selectedPoint;
    const markerMesh = markerMeshRef.current;
    const haloMesh = haloMeshRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!markerMesh || !haloMesh || !renderer || !scene || !camera) return;

    const object = new THREE.Object3D();
    const color = new THREE.Color();
    const highlightColor = new THREE.Color(0xffffff);
    markerStateRef.current.forEach(({ point, x, z, index }) => {
      const selected = point.id === selectedPoint?.id &&
        point.typeObjet === selectedPoint?.typeObjet;
      const height = selected ? 1.35 : 0.82;
      object.position.set(x, height / 2 + 0.08, z);
      object.scale.set(selected ? 1.2 : 1, height, selected ? 1.2 : 1);
      object.updateMatrix();
      markerMesh.setMatrixAt(index, object.matrix);
      color.setHex(TYPE_COLORS[point.typeObjet]);
      if (selected) color.lerp(highlightColor, 0.2);
      markerMesh.setColorAt(index, color);

      object.position.set(x, 0.035, z);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.setScalar(selected ? 1.35 : 1);
      object.updateMatrix();
      haloMesh.setMatrixAt(index, object.matrix);
      haloMesh.setColorAt(index, color);
    });
    markerMesh.instanceMatrix.needsUpdate = true;
    haloMesh.instanceMatrix.needsUpdate = true;
    if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
    if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
  }, [selectedPoint]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setSceneError('La scène 3D n’est pas disponible sur cet appareil. Utilisez la carte 2D.');
      return;
    }

    setSceneError(null);
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c1711);
    scene.fog = new THREE.Fog(0x0c1711, 30, 75);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    cameraRef.current = camera;
    const rendererElement = renderer.domElement;
    rendererElement.setAttribute('aria-hidden', 'true');
    rendererElement.style.display = 'block';
    rendererElement.style.width = '100%';
    rendererElement.style.height = '100%';
    rendererElement.style.touchAction = 'none';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    host.appendChild(rendererElement);

    const hemisphere = new THREE.HemisphereLight(0xc4f4d5, 0x101a13, 2.1);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xe1ffe9, 2.8);
    keyLight.position.set(-8, 16, 10);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0x35d68e, 24, 35);
    accentLight.position.set(8, 8, -5);
    scene.add(accentLight);

    const validPoints = points.flatMap((point) => {
      const latitude = Number(point.latitude);
      const longitude = Number(point.longitude);
      return Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
        ? [{ point, latitude, longitude }]
        : [];
    });

    const bounds = validPoints.reduce(
      (current, item) => ({
        minLatitude: Math.min(current.minLatitude, item.latitude),
        maxLatitude: Math.max(current.maxLatitude, item.latitude),
        minLongitude: Math.min(current.minLongitude, item.longitude),
        maxLongitude: Math.max(current.maxLongitude, item.longitude),
      }),
      {
        minLatitude: Number.POSITIVE_INFINITY,
        maxLatitude: Number.NEGATIVE_INFINITY,
        minLongitude: Number.POSITIVE_INFINITY,
        maxLongitude: Number.NEGATIVE_INFINITY,
      }
    );
    const minLatitude = validPoints.length ? bounds.minLatitude : 14.6837;
    const maxLatitude = validPoints.length ? bounds.maxLatitude : 14.7037;
    const minLongitude = validPoints.length ? bounds.minLongitude : -17.4541;
    const maxLongitude = validPoints.length ? bounds.maxLongitude : -17.4341;
    const centerLatitude = (minLatitude + maxLatitude) / 2;
    const centerLongitude = (minLongitude + maxLongitude) / 2;
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.012);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.012);
    const span = Math.max(latitudeSpan, longitudeSpan * Math.cos(centerLatitude * Math.PI / 180));
    const worldScale = 23 / span;
    const extentX = Math.min(23, longitudeSpan * worldScale * Math.cos(centerLatitude * Math.PI / 180));
    const extentZ = Math.min(23, latitudeSpan * worldScale);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshStandardMaterial({ color: 0x101d15, roughness: 0.92, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    scene.add(ground);

    const grid = new THREE.GridHelper(34, 34, 0x31533d, 0x203829);
    grid.position.y = -0.06;
    scene.add(grid);

    const city = new THREE.Group();
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a2e21,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x07130b,
    });
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x26362b,
      roughness: 0.9,
      metalness: 0.03,
    });
    const rows = 5;
    const columns = 6;
    const cellWidth = Math.max(extentX / columns, 1.15);
    const cellDepth = Math.max(extentZ / rows, 1.15);
    const blockWidth = Math.max(cellWidth * 0.59, 0.48);
    const blockDepth = Math.max(cellDepth * 0.56, 0.45);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const hash = (row * 17 + column * 29 + row * column * 7) % 11;
        const height = 0.35 + (hash % 5) * 0.17;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(blockWidth, height, blockDepth),
          blockMaterial
        );
        block.position.set(
          -extentX / 2 + cellWidth * (column + 0.5),
          height / 2,
          -extentZ / 2 + cellDepth * (row + 0.5)
        );
        city.add(block);
      }
    }

    for (let column = 0; column <= columns; column += 1) {
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.025, extentZ + 1),
        roadMaterial
      );
      road.position.set(-extentX / 2 + cellWidth * column, 0.01, 0);
      city.add(road);
    }
    for (let row = 0; row <= rows; row += 1) {
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(extentX + 1, 0.025, 0.1),
        roadMaterial
      );
      road.position.set(0, 0.012, -extentZ / 2 + cellDepth * row);
      city.add(road);
    }
    scene.add(city);

    const markers = new THREE.Group();
    const markerGeometry = new THREE.CylinderGeometry(0.12, 0.16, 1, 8);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x1c2c20,
      emissiveIntensity: 0.65,
      roughness: 0.34,
      metalness: 0.18,
      vertexColors: true,
    });
    const markerMesh = new THREE.InstancedMesh(markerGeometry, markerMaterial, validPoints.length);
    const haloGeometry = new THREE.RingGeometry(0.19, 0.24, 24);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const haloMesh = new THREE.InstancedMesh(haloGeometry, haloMaterial, validPoints.length);
    const instance = new THREE.Object3D();
    const markerColor = new THREE.Color();

    validPoints.forEach((entry, index) => {
      const x = (entry.longitude - centerLongitude) * worldScale * Math.cos(centerLatitude * Math.PI / 180);
      const z = -(entry.latitude - centerLatitude) * worldScale;
      const selected = entry.point.id === selectedPointRef.current?.id &&
        entry.point.typeObjet === selectedPointRef.current?.typeObjet;
      const height = selected ? 1.35 : 0.82;
      markerColor.setHex(TYPE_COLORS[entry.point.typeObjet]);
      if (selected) markerColor.lerp(new THREE.Color(0xffffff), 0.2);
      instance.position.set(x, height / 2 + 0.08, z);
      instance.scale.set(selected ? 1.2 : 1, height, selected ? 1.2 : 1);
      instance.updateMatrix();
      markerMesh.setMatrixAt(index, instance.matrix);
      markerMesh.setColorAt(index, markerColor);

      instance.position.set(x, 0.035, z);
      instance.rotation.set(-Math.PI / 2, 0, 0);
      instance.scale.setScalar(selected ? 1.35 : 1);
      instance.updateMatrix();
      haloMesh.setMatrixAt(index, instance.matrix);
      haloMesh.setColorAt(index, markerColor);
    });
    markerMesh.instanceMatrix.needsUpdate = true;
    haloMesh.instanceMatrix.needsUpdate = true;
    if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
    if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
    markers.add(haloMesh, markerMesh);
    scene.add(markers);
    markerStateRef.current = validPoints.map((entry, index) => ({
      point: entry.point,
      x: (entry.longitude - centerLongitude) * worldScale * Math.cos(centerLatitude * Math.PI / 180),
      z: -(entry.latitude - centerLatitude) * worldScale,
      index,
    }));
    markerMeshRef.current = markerMesh;
    haloMeshRef.current = haloMesh;

    const target = new THREE.Vector3(0, 0, 0);
    const radius = Math.max(extentX, extentZ, 10) * 1.32;
    let theta = Math.PI / 4;
    let phi = Math.PI / 3.05;
    let distance = radius;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let pointerMoved = false;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const updateCamera = () => {
      const safePhi = THREE.MathUtils.clamp(phi, 0.22, Math.PI / 2.03);
      camera.position.set(
        target.x + distance * Math.sin(safePhi) * Math.sin(theta),
        target.y + distance * Math.cos(safePhi),
        target.z + distance * Math.sin(safePhi) * Math.cos(theta)
      );
      camera.lookAt(target);
    };
    const zoom = (direction: number) => {
      distance = THREE.MathUtils.clamp(distance + direction, 9, 54);
      updateCamera();
      renderer.render(scene, camera);
    };
    zoomRef.current = zoom;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };

    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerMoved = false;
      startX = event.clientX;
      startY = event.clientY;
      rendererElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) pointerMoved = true;
      theta -= deltaX * 0.008;
      phi = THREE.MathUtils.clamp(phi + deltaY * 0.006, 0.22, Math.PI / 2.03);
      startX = event.clientX;
      startY = event.clientY;
      updateCamera();
      renderer.render(scene, camera);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (rendererElement.hasPointerCapture(event.pointerId)) {
        rendererElement.releasePointerCapture(event.pointerId);
      }
      if (pointerMoved) return;
      const bounds = rendererElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(markerMesh, false)[0];
      const point = hit?.instanceId === undefined
        ? undefined
        : validPoints[hit.instanceId]?.point;
      if (point) selectRef.current(point);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY * 0.018);
    };

    updateCamera();
    resize();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resize);
    observer?.observe(host);
    if (!observer) window.addEventListener('resize', resize);
    rendererElement.addEventListener('pointerdown', pointerDown);
    rendererElement.addEventListener('pointermove', pointerMove);
    rendererElement.addEventListener('pointerup', pointerUp);
    rendererElement.addEventListener('pointercancel', pointerUp);
    rendererElement.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      rendererElement.removeEventListener('pointerdown', pointerDown);
      rendererElement.removeEventListener('pointermove', pointerMove);
      rendererElement.removeEventListener('pointerup', pointerUp);
      rendererElement.removeEventListener('pointercancel', pointerUp);
      rendererElement.removeEventListener('wheel', wheel);
      disposeObject(scene);
      renderer.dispose();
      rendererElement.remove();
      if (markerMeshRef.current && markerMeshRef.current.parent === scene) {
        markerMeshRef.current = null;
      }
      if (haloMeshRef.current && haloMeshRef.current.parent === scene) {
        haloMeshRef.current = null;
      }
      if (rendererRef.current === renderer) rendererRef.current = null;
      if (sceneRef.current === scene) sceneRef.current = null;
      if (cameraRef.current === camera) cameraRef.current = null;
      if (zoomRef.current === zoom) zoomRef.current = null;
      markerStateRef.current = [];
    };
  }, [points]);

  return (
    <div className="ops-scene">
      <div
        ref={hostRef}
        className="ops-scene__viewport"
        role="img"
        aria-label="Scène 3D schématique de Dakar. Faites glisser pour tourner, utilisez la molette ou le pincement pour zoomer, sélectionnez un repère pour consulter l’objet."
      />
      <div className="ops-scene__label" aria-hidden="true">
        MAQUETTE SCHÉMATIQUE · POSITIONS BASÉES SUR LES COORDONNÉES
      </div>
      {sceneError ? (
        <div className="ops-scene__error" role="status">{sceneError}</div>
      ) : (
        <div className="ops-scene__help" aria-hidden="true">
            Glisser pour tourner · Molette ou boutons pour zoomer
        </div>
      )}
        <div className="ops-scene__zoom" role="group" aria-label="Zoom de la scène 3D">
          <button
            type="button"
            aria-label="Zoomer sur la scène"
            title="Zoomer"
            onClick={() => zoomRef.current?.(-2)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Dézoomer sur la scène"
            title="Dézoomer"
            onClick={() => zoomRef.current?.(2)}
          >
            −
          </button>
        </div>
      <div className="ops-scene__legend" aria-label="Légende des repères">
        <span><i className="ops-legend-dot ops-legend-dot--signalement" /> Signalements</span>
        <span><i className="ops-legend-dot ops-legend-dot--dossier" /> Dossiers</span>
        <span><i className="ops-legend-dot ops-legend-dot--intervention" /> Missions</span>
      </div>
    </div>
  );
};
