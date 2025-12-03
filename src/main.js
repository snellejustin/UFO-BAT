import { createScene, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createPlayButton, createLevelProgressBar, createGameOverScreen } from './ui.js';
import { createHealthManager } from './health.js';
import { createCountdown } from './countdown.js';
import { createLevelManager } from './levels.js';
import { createUFO } from './ufo.js';
import { createProjectileManager } from './projectiles.js';
import { createHealthBoost } from './powerups/health-boost.js';
import { createShield } from './powerups/shield.js';
import { createRocketShooter } from './powerups/rocketshooter.js';
import * as BABYLON from '@babylonjs/core';

const initGame = async () => {
  const canvas = document.getElementById('renderCanvas');
  const engine = createEngine(canvas);

  engine.displayLoadingUI();

  const scene = createScene(engine);

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

  // Create level progress bar
  const levelProgressBar = createLevelProgressBar(scene, 5);

  const levelManager = createLevelManager(
    scene,
    asteroidSystem,
    ufo,
    healthBoost,
    shield,
    projectileManager,
    rocketShooter,
    levelProgressBar
  );

  disableCameraArrowKeys(scene);
  const inputWrapper = setupArrowKeys();
  setupRocketshipPhysics(scene, spaceship, inputWrapper);

  healthManager.setupCollisionListener(asteroidSystem.manager, scene.activeCamera);
  healthManager.setupProjectileCollisionListener(projectileManager, scene.activeCamera);

  engine.hideLoadingUI();

  const uiState = createPlayButton(countdown, levelManager);

  const handleGameOver = async () => {
    //stop de game loop
    uiState.isPlaying = false;
    asteroidSystem.manager.isActive = false;

    //stop alle actieve systemen
    levelManager.stop();
    ufo.stop();

    //reset powerups en systemen
    healthBoost.reset();
    shield.reset();
    rocketShooter.reset();

    //game over scherm tonen
    await createGameOverScreen(
      scene,
      //restart callback
      () => {
        scene.onAfterPhysicsObservable.addOnce(() => {
          healthManager.setHealth(100);

          //volledige reset voor nieuwe game
          asteroidSystem.reset();
          projectileManager.reset();
          levelManager.reset();
          ufo.reset();
          healthBoost.reset();
          shield.reset();
          rocketShooter.reset();

          levelProgressBar.updateProgress(0);
          countdown.startCountdown(() => {
            uiState.isPlaying = true;
            levelManager.startFirstLevel();
          });
        });
      },
      //quit callback
      () => {
        scene.onAfterPhysicsObservable.addOnce(() => {
          healthManager.setHealth(100);

          asteroidSystem.reset();
          projectileManager.reset();
          levelManager.reset();
          ufo.reset();
          healthBoost.reset();
          shield.reset();
          rocketShooter.reset();
          levelProgressBar.updateProgress(0);

          const playButtonContainer = document.getElementById('ui-container');
          if (playButtonContainer) {
            playButtonContainer.style.display = 'flex';
          }
          uiState.isPlaying = false;
        });
      }
    );
  };

  healthManager.setOnGameOver(handleGameOver);

  startRenderLoop(engine, scene, () => {
    if (uiState.isPlaying) {
      asteroidSystem.update();
      projectileManager.update();
    }
  });
};

initGame().catch(console.error);