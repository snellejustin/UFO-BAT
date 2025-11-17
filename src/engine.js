import * as BABYLON from '@babylonjs/core';

/**
 * Initializes and manages the Babylon.js engine and render loop
 * @param {HTMLCanvasElement} canvas - The canvas element to render to
 * @returns {BABYLON.Engine} The initialized engine
 */
export const createEngine = (canvas) => {
  const engine = new BABYLON.Engine(canvas);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    engine.resize();
  });

  return engine;
};

/**
 * Starts the main render loop
 * @param {BABYLON.Engine} engine - The engine instance
 * @param {BABYLON.Scene} scene - The scene to render
 * @param {Function} onUpdate - Optional callback to run each frame before render
 */
export const startRenderLoop = (engine, scene, onUpdate) => {
  engine.runRenderLoop(() => {
    // Call update callback if provided
    if (onUpdate) {
      onUpdate();
    }
    scene.render();
  });
};
