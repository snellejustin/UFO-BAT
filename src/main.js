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
import { createHealthBoost } from './powerups/health-boost.js';
import { createShield } from './powerups/shield.js';

const canvas = document.getElementById('renderCanvas');
const engine = createEngine(canvas);
const scene = createScene(engine);

const asteroidSystem = createAsteroidManager(scene);
const projectileManager = createProjectileManager(scene);
const ufo = createUFO(scene, projectileManager);

const spaceship = await createRocketship(scene);
const shield = createShield(scene, spaceship, scene.activeCamera);
const healthManager = createHealthManager(scene, spaceship, shield);
const healthBoost = createHealthBoost(scene, spaceship, healthManager, scene.activeCamera);

const levelManager = createLevelManager(asteroidSystem, ufo, healthBoost, shield);
const countdown = createCountdown();
const gameState = createPlayButton(countdown, levelManager);
const scoreManager = createScoreManager();

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
