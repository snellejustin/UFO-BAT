import { createScene, disableCameraArrowKeys } from './scene.js';
import { createRocketship, setupRocketshipPhysics, setupArrowKeys } from './rocketship.js';
import { createEngine, startRenderLoop } from './engine.js';
import { createAsteroidManager } from './asteroids.js';
import { createPlayButton } from './ui.js';
import { createScoreManager } from './score.js';
import { createHealthManager } from './health.js';
import { createCountdown } from './countdown.js';
import { createLevelManager } from './levels.js';
import { createUFO } from './ufo.js';
import { createProjectileManager } from './projectiles.js';

const canvas = document.getElementById('renderCanvas');
const engine = createEngine(canvas);
const scene = createScene(engine);

const asteroidSystem = createAsteroidManager(scene);
const projectileManager = createProjectileManager(scene);
const ufo = createUFO(scene, projectileManager);
const levelManager = createLevelManager(asteroidSystem, ufo);
const countdown = createCountdown();
const gameState = createPlayButton(countdown, levelManager);
const scoreManager = createScoreManager();

const spaceship = await createRocketship(scene);
const healthManager = createHealthManager(scene, spaceship);

disableCameraArrowKeys(scene);
const inputMap = setupArrowKeys();
setupRocketshipPhysics(scene, spaceship, inputMap);

healthManager.setupCollisionListener(asteroidSystem.manager, scene.activeCamera);
healthManager.setupProjectileCollisionListener(projectileManager, scene.activeCamera);

startRenderLoop(engine, scene, () => {
    asteroidSystem.update();
    projectileManager.update();
    
    if (levelManager.isWaveActive()) {
        scoreManager.addScore(1);
    }
});
