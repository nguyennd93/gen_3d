import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function ModelViewer({ modelUrl }) {
  const rotationRef = useRef(0);       // Rotation angle around Y-axis
  const lastTouchX = useRef(null);     // Store previous touch X position

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1, 5);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        scene.add(gltf.scene);
        animate();
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );

    const animate = () => {
      requestAnimationFrame(animate);

      // Calculate camera position rotating around Y-axis
      const radius = 5;
      const angle = rotationRef.current;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.lookAt(new THREE.Vector3(0, 0, 0));

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
  };

  return (
    <GLView
      style={{ flex: 1 }}
      onContextCreate={onContextCreate}
      onStartShouldSetResponder={() => true}
      onResponderMove={(e) => {
        const touchX = e.nativeEvent.locationX;
        if (lastTouchX.current !== null) {
          const deltaX = touchX - lastTouchX.current;
          rotationRef.current += deltaX * 0.005; // Increase rotation angle
        }
        lastTouchX.current = touchX;
      }}
      onResponderRelease={() => {
        lastTouchX.current = null;
      }}
    />
  );
}