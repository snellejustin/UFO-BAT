import { createScene, createMeshes, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createPlayButton } from './ui.js';
import { createScoreManager } from './score.js';
import { createHealthManager } from './health.js';
import { Inspector } from '@babylonjs/inspector';


// Initialize engine and scene
const canvas = document.getElementById('renderCanvas');
const engine = createEngine(canvas);
const scene = createScene(engine);

// Create game state with play button
const gameState = createPlayButton();

// Create score manager
const scoreManager = createScoreManager();

// Create game objects
const ufo = createMeshes(scene);
const spaceship = createRocketship(scene);

// Create health manager (needs scene and rocketship)
const healthManager = createHealthManager(scene, spaceship);

// Create asteroid manager
const asteroidSystem = createAsteroidManager(scene);

// Link game state to asteroid manager
asteroidSystem.manager.isActive = gameState.isPlaying;

// Update asteroid manager's isActive when game state changes
const checkGameState = () => {
    asteroidSystem.manager.isActive = gameState.isPlaying;
};

// Disable camera arrow-key controls so we can use them for the spaceship
disableCameraArrowKeys(scene);

// Setup arrow key input bindings
const inputMap = setupArrowKeys();

// Setup rocketship physics and movement
setupRocketshipPhysics(scene, spaceship, inputMap);

// Setup collision listener for asteroids hitting the rocketship
healthManager.setupCollisionListener(asteroidSystem.manager, scene.activeCamera);

// Start the render loop with asteroid updates and score increment
startRenderLoop(engine, scene, () => {
  checkGameState(); // Update asteroid manager's game state
  asteroidSystem.update();
  
  // Increment score while game is playing
  if (gameState.isPlaying) {
    scoreManager.addScore(1); // Add 1 point per frame
  }
});

// // Show Babylon.js Inspector for debugging
// Inspector.Show(scene, {});
