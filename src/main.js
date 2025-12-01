import { createScene, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createPlayButton } from './ui.js';
import { createHealthManager } from './health.js';
import { createCountdown } from './countdown.js';
import { createLevelManager } from './levels.js';
import { createUFO } from './ufo.js';
import { createProjectileManager } from './projectiles.js';
import { createHealthBoost } from './powerups/health-boost.js';
import { createShield } from './powerups/shield.js';
import { createRocketShooter } from './powerups/rocketshooter.js';
// import { createBackground } from './background.js'; // <--- DISABLED
import * as BABYLON from '@babylonjs/core';

const initGame = async () => {
  const canvas = document.getElementById('renderCanvas');
  const engine = createEngine(canvas);

  engine.displayLoadingUI();

  const scene = createScene(engine);

  // --- SHADER DISABLED ---
  // createBackground(scene);
  // -----------------------

  const asteroidSystem = createAsteroidManager(scene);
  const projectileManager = createProjectileManager(scene);
  const countdown = createCountdown(scene);

  const [spaceship, ufo] = await Promise.all([
    createRocketship(scene),
    createUFO(scene, projectileManager)
  ]);

  const shield = createShield(scene, spaceship, scene.activeCamera);
  const healthManager = createHealthManager(scene, spaceship, shield);
  const healthBoost = createHealthBoost(scene, spaceship, healthManager, scene.activeCamera);
  const rocketShooter = createRocketShooter(scene, spaceship, scene.activeCamera, projectileManager);

  const levelManager = createLevelManager(
    scene,
    asteroidSystem,
    ufo,
    healthBoost,
    shield,
    projectileManager,
    rocketShooter
  );

  disableCameraArrowKeys(scene);
  const inputWrapper = setupArrowKeys();
  setupRocketshipPhysics(scene, spaceship, inputWrapper);

  healthManager.setupCollisionListener(asteroidSystem.manager, scene.activeCamera);
  healthManager.setupProjectileCollisionListener(projectileManager, scene.activeCamera);

  engine.hideLoadingUI();

  const uiState = createPlayButton(countdown, levelManager);

  startRenderLoop(engine, scene, () => {
    if (uiState.isPlaying) {
      asteroidSystem.update();
      projectileManager.update();
    }
  });
};

initGame().catch(console.error);