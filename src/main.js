import { createScene, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createIdleScreen, createLevelProgressBar, createGameOverScreen } from './ui.js';
import { playEndSequence, playGameOverSequence } from './videos.js';
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
    "assets/sounds/background.mp3",
    {
      loop: true,
      autoplay: false,
      volume: 0.7,
      maxInstances: 1
    }
  );

  const windSound = await BABYLON.CreateSoundAsync(
    "windSound",
    "assets/sounds/background_wind-sound.mp3",
    {
      loop: true,
      autoplay: false,
      volume: 3,
      maxInstances: 1
    }
  );

  const idleSound = await BABYLON.CreateSoundAsync(
    "idleSound",
    "assets/sounds/Soundtrack-idlestate.mp3",
    {
      loop: true,
      autoplay: true,
      volume: 0.3,
      maxInstances: 1
    }
  );

  //managers aanmaken
  const asteroidSystem = createAsteroidManager(scene);
  const projectileManager = await createProjectileManager(scene);
  const countdown = createCountdown(scene);

  //start music when countdown starts
  countdown.onCountdownStart = () => {
    backgroundMusic.play();
    windSound.play();
  };

  //assets asynchroon laden
  const [spaceship, ufo] = await Promise.all([
    createRocketship(scene),
    createUFO(scene, projectileManager, backgroundMusic)
  ]);

  //powerups & health setup
  const shield = createShield(scene, spaceship, scene.activeCamera, audioEngine);
  const healthManager = await createHealthManager(scene, spaceship, shield);
  const healthBoost = createHealthBoost(scene, spaceship, healthManager, scene.activeCamera, audioEngine);
  const rocketShooter = createRocketShooter(scene, spaceship, scene.activeCamera, projectileManager, audioEngine);

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
      if (backgroundMusic) {
        backgroundMusic.stop();
      }
      if (windSound) {
        windSound.stop();
      }
      
      //stop shooting immediately
      rocketShooter.reset();
      projectileManager.reset(); //clear existing projectiles so they don't make noise during video

      playEndSequence(scene, uiState ? uiState.outroVideoTexture : null, uiState ? uiState.victoryVideoTexture : null, () => {
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
              uiState = createIdleScreen(scene, countdown, levelManager, idleSound);
              if (idleSound && !idleSound.isPlaying) idleSound.play();
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

  uiState = createIdleScreen(scene, countdown, levelManager, idleSound);


  const handleGameOver = async () => {
    if (uiState.isGameOverProcessing) return;
    uiState.isGameOverProcessing = true;

    //stop alles direct
    uiState.isPlaying = false;
    healthManager.setPaused(true);
    asteroidSystem.manager.isActive = false;
    levelManager.stop();
    ufo.stop();
    if (backgroundMusic) {
      backgroundMusic.stop(); // Stop music immediately on death
    }
    if (windSound) {
      windSound.stop();
    }

    //reset powerups zodat ze niet blijven zweven/werken
    healthBoost.reset();
    shield.reset();
    rocketShooter.reset();
    projectileManager.reset(); // Clear projectiles

    // Play Game Over Video first
    playGameOverSequence(scene, uiState ? uiState.gameoverVideoTexture : null, async () => {
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
              levelProgressBar.reset();

              // Dispose old UI state and recreate to refresh video textures
              if (uiState && uiState.dispose) uiState.dispose();
              uiState = createIdleScreen(scene, countdown, levelManager, idleSound);
              
              // Immediately hide the idle screen and prepare for game
              uiState.startImmediate();
              uiState.isPlaying = false; // Pause updates during countdown

              //start direct de countdown
              countdown.startCountdown(() => {
                uiState.isPlaying = true;
                levelManager.startFirstLevel();
              });

              //ensure music is playing on restart
              if (!backgroundMusic.isPlaying) {
                backgroundMusic.play();
              }
              if (!windSound.isPlaying) {
                windSound.play();
              }
            });
          },
          //QUIT CALLBACK (Terug naar hoofdmenu)
          () => {
            uiState.isGameOverProcessing = false;
            //stop music on quit
            if (backgroundMusic) {
              backgroundMusic.stop();
            }
            if (windSound) {
              windSound.stop();
            }

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
              levelProgressBar.reset();
              
              if (uiState && uiState.dispose) uiState.dispose();
              uiState = createIdleScreen(scene, countdown, levelManager, idleSound);
              uiState.isPlaying = false;
              if (idleSound && !idleSound.isPlaying) idleSound.play();
            });
          }
        );
    });
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