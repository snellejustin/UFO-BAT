import { createScene, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createIdleScreen, createLevelProgressBar, createGameOverScreen, playEndSequence } from './ui.js';
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
  const audioEngine = await BABYLON.CreateAudioEngineAsync();

  engine.displayLoadingUI();

  const scene = createScene(engine);

  const backgroundMusic = await BABYLON.CreateSoundAsync(
    "backgroundMusic",
    "assets/sounds/Galaxy.mp3",
    {
      loop: true,
      autoplay: false,
      volume: 0.05,
      maxInstances: 1
    }
  );

  //managers aanmaken
  const asteroidSystem = createAsteroidManager(scene);
  const projectileManager = await createProjectileManager(scene);
  const countdown = createCountdown(scene);

  //assets asynchroon laden
  const [spaceship, ufo] = await Promise.all([
    createRocketship(scene),
    createUFO(scene, projectileManager)
  ]);

  //powerups & health setup
  const shield = createShield(scene, spaceship, scene.activeCamera);
  const healthManager = await createHealthManager(scene, spaceship, shield);
  const healthBoost = createHealthBoost(scene, spaceship, healthManager, scene.activeCamera);
  const rocketShooter = createRocketShooter(scene, spaceship, scene.activeCamera, projectileManager);

  //UI elementen
  const levelProgressBar = createLevelProgressBar(scene, 5);

  let uiState = null;

  const handleGameComplete = () => {
      //stop game logic
      if (uiState) uiState.isPlaying = false;
      healthManager.setPaused(true);
      asteroidSystem.manager.isActive = false;
      levelManager.stop();
      ufo.stop();
      backgroundMusic.stop();
      
      //stop shooting immediately
      rocketShooter.reset();
      projectileManager.reset(); //clear existing projectiles so they don't make noise during video

      playEndSequence(scene, uiState ? uiState.outroVideoTexture : null, () => {
          //reset game to idle state
          scene.onAfterPhysicsObservable.addOnce(() => {
              healthManager.setPaused(false);
              healthManager.setHealth(100);
              asteroidSystem.reset();
              projectileManager.reset();
              levelManager.reset();
              if (levelManager.resetPracticeState) {
                  levelManager.resetPracticeState();
              }
              ufo.reset();
              healthBoost.reset();
              shield.reset();
              rocketShooter.reset();
              levelProgressBar.reset();
              
              //recreate idle screen
              if (uiState && uiState.dispose) uiState.dispose();
              uiState = createIdleScreen(scene, countdown, levelManager);
          });
      });
  };

  //level manager
  const levelManager = createLevelManager(
    scene,
    asteroidSystem,
    ufo,
    healthBoost,
    shield,
    projectileManager,
    rocketShooter,
    levelProgressBar,
    handleGameComplete
  );

  //input & physics
  disableCameraArrowKeys(scene);
  const inputWrapper = setupArrowKeys();
  setupRocketshipPhysics(scene, spaceship, inputWrapper);

  //botsingen koppelen
  healthManager.setupCollisionListener(asteroidSystem.manager, scene.activeCamera);
  healthManager.setupProjectileCollisionListener(projectileManager, scene.activeCamera);

  engine.hideLoadingUI();

  uiState = createIdleScreen(scene, countdown, levelManager);
  
  //start music when countdown starts
  countdown.onCountdownStart = () => {
    backgroundMusic.play();
  };

  const handleGameOver = async () => {
    if (uiState.isGameOverProcessing) return;
    uiState.isGameOverProcessing = true;

    //stop alles direct
    uiState.isPlaying = false;
    healthManager.setPaused(true);
    asteroidSystem.manager.isActive = false;
    levelManager.stop();
    ufo.stop();

    //reset powerups zodat ze niet blijven zweven/werken
    healthBoost.reset();
    shield.reset();
    rocketShooter.reset();

    //toon Game Over scherm
    await createGameOverScreen(
      scene,
      //RESTART CALLBACK (Direct opnieuw spelen)
      () => {
        uiState.isGameOverProcessing = false;
        //voer resets uit NA de physics stap om crashes te voorkomen
        scene.onAfterPhysicsObservable.addOnce(() => {
          healthManager.setPaused(false);
          healthManager.setHealth(100);
          asteroidSystem.reset();
          projectileManager.reset();
          levelManager.reset();
          ufo.reset();
          healthBoost.reset();
          shield.reset();
          rocketShooter.reset();
          levelProgressBar.updateProgress(0);

          //start direct de countdown
          countdown.startCountdown(() => {
            uiState.isPlaying = true;
            levelManager.startFirstLevel();
          });

          //ensure music is playing on restart
          if (!backgroundMusic.isPlaying) {
            backgroundMusic.play();
          }
        });
      },
      //QUIT CALLBACK (Terug naar hoofdmenu)
      () => {
        uiState.isGameOverProcessing = false;
        //stop music on quit
        backgroundMusic.stop();

        scene.onAfterPhysicsObservable.addOnce(() => {
          //reset alles naar beginstaat
          healthManager.setPaused(false);
          healthManager.setHealth(100);
          asteroidSystem.reset();
          projectileManager.reset();
          levelManager.reset();
          if (levelManager.resetPracticeState) {
            levelManager.resetPracticeState();
          }
          ufo.reset();
          healthBoost.reset();
          shield.reset();
          rocketShooter.reset();
          levelProgressBar.updateProgress(0);
          uiState = createIdleScreen(scene, countdown, levelManager);
          uiState.isPlaying = false;
        });
      }
    );
  };

  healthManager.setOnGameOver(handleGameOver);

  startRenderLoop(engine, scene, () => {
    //update loops draaien alleen als het spel bezig is
    if (uiState.isPlaying) {
      asteroidSystem.update();
      projectileManager.update();
    }
  });
};

initGame().catch(console.error);