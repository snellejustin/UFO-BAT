import * as BABYLON from '@babylonjs/core';

export const createEngine = (canvas) => {
  const engine = new BABYLON.Engine(canvas);
  
  window.addEventListener('resize', () => {
    engine.resize();
  });

  return engine;
};

export const startRenderLoop = (engine, scene, onUpdate) => {
  engine.runRenderLoop(() => {
    if (onUpdate) {
      onUpdate();
    }
    scene.render();
  });
};
