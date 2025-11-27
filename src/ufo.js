import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const smoothStep = (t) => t * t * (3 - 2 * t);

const UFO_CONFIG = {
    startPosition: { x: 0, y: 15, z: 0 },
    rotation: { default: -45, min: -70, max: -40 },
    pathPoints: 5,
    pathXRange: { min: -8, max: 8 },
    pathYRange: { min: 4, max: 7 },
    timePerPoint: 2000,
    enterDuration: 2000,
    exitDuration: 1000,
    totalShots: 3,
    rotationSpeed: 0.001
};

export const createUFO = async (scene, projectileManager, modelFilename = "ufoalien1.glb") => {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/blender-models/",
        modelFilename,
        scene
    );

    const ufo = result.meshes[0];
    ufo.name = "ufo";
    ufo.position.set(UFO_CONFIG.startPosition.x, UFO_CONFIG.startPosition.y, UFO_CONFIG.startPosition.z);

    const ufoMeshes = result.meshes.filter(mesh => mesh !== ufo);
    const setUFORotation = (angle) => {
        ufoMeshes.forEach(mesh => {
            mesh.rotation.x = BABYLON.Tools.ToRadians(angle);
        });
    };
    setUFORotation(UFO_CONFIG.rotation.default);

    let isFlying = false;
    let flyingAnimation = null;
    let currentUfo = ufo;
    let currentUfoMeshes = ufoMeshes;

    const loadNewModel = async (newModelFilename) => {
        if (isFlying) return;

        currentUfoMeshes.forEach(mesh => mesh.dispose());
        currentUfo.dispose();

        const newResult = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "assets/blender-models/",
            newModelFilename,
            scene
        );

        currentUfo = newResult.meshes[0];
        currentUfo.name = "ufo";
        currentUfo.position.set(UFO_CONFIG.startPosition.x, UFO_CONFIG.startPosition.y, UFO_CONFIG.startPosition.z);

        currentUfoMeshes = newResult.meshes.filter(mesh => mesh !== currentUfo);
        currentUfoMeshes.forEach(mesh => {
            mesh.rotation.x = BABYLON.Tools.ToRadians(UFO_CONFIG.rotation.default);
        });
    };

    const flyUFO = (onComplete, difficultyConfig = {}) => {
        if (isFlying) return;

        isFlying = true;

        const config = {
            pathPoints: difficultyConfig.pathPoints ?? UFO_CONFIG.pathPoints,
            pathXRange: difficultyConfig.pathXRange ?? UFO_CONFIG.pathXRange,
            pathYRange: difficultyConfig.pathYRange ?? UFO_CONFIG.pathYRange,
            timePerPoint: difficultyConfig.timePerPoint ?? UFO_CONFIG.timePerPoint,
            totalShots: difficultyConfig.totalShots ?? UFO_CONFIG.totalShots,
            enterDuration: difficultyConfig.enterDuration ?? UFO_CONFIG.enterDuration,
            exitDuration: difficultyConfig.exitDuration ?? UFO_CONFIG.exitDuration,
            projectileSpeed: difficultyConfig.projectileSpeed ?? -5,
            shootingPattern: difficultyConfig.shootingPattern ?? "single"
        };

        const shootProjectiles = (position, speed) => {
            if (!projectileManager) return;

            if (config.shootingPattern === "spread") {
                const angle = 30;
                const angleRad = BABYLON.Tools.ToRadians(angle);
                
                const leftVelocity = new BABYLON.Vector3(
                    Math.sin(-angleRad) * Math.abs(speed),
                    Math.cos(-angleRad) * speed,
                    0
                );
                
                const rightVelocity = new BABYLON.Vector3(
                    Math.sin(angleRad) * Math.abs(speed),
                    Math.cos(angleRad) * speed,
                    0
                );
                
                projectileManager.shootProjectile(position.clone(), speed, leftVelocity);
                projectileManager.shootProjectile(position.clone(), speed, rightVelocity);
            } else if (config.shootingPattern === "tripleSpread") {
                const angle = 30;
                const angleRad = BABYLON.Tools.ToRadians(angle);
                
                const leftVelocity = new BABYLON.Vector3(
                    Math.sin(-angleRad) * Math.abs(speed),
                    Math.cos(-angleRad) * speed,
                    0
                );
                
                const rightVelocity = new BABYLON.Vector3(
                    Math.sin(angleRad) * Math.abs(speed),
                    Math.cos(angleRad) * speed,
                    0
                );
                
                projectileManager.shootProjectile(position.clone(), speed, leftVelocity);
                projectileManager.shootProjectile(position.clone(), speed);
                projectileManager.shootProjectile(position.clone(), speed, rightVelocity);
            } else {
                projectileManager.shootProjectile(position, speed);
            }
        };

        const generatePath = () => {
            const path = [];
            for (let i = 0; i < config.pathPoints; i++) {
                path.push(new BABYLON.Vector2(
                    Math.random() * (config.pathXRange.max - config.pathXRange.min) + config.pathXRange.min,
                    Math.random() * (config.pathYRange.max - config.pathYRange.min) + config.pathYRange.min
                ));
            }
            return path;
        };

        const path = generatePath();

        let currentPointIndex = 0;
        let timeAtPoint = 0;
        let shotsFired = 0;
        let phase = 'entering';
        let rotationTime = 0;

        flyingAnimation = scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime();

            rotationTime += dt;
            const sineWave = Math.sin(rotationTime * UFO_CONFIG.rotationSpeed);
            const rotationProgress = smoothStep((sineWave + 1) / 2);
            const rotationAngle = BABYLON.Scalar.Lerp(UFO_CONFIG.rotation.min, UFO_CONFIG.rotation.max, rotationProgress);
            currentUfoMeshes.forEach(mesh => {
                mesh.rotation.x = BABYLON.Tools.ToRadians(rotationAngle);
            });

            if (phase === 'entering') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / config.enterDuration, 1);
                const easedProgress = smoothStep(progress);
                currentUfo.position.x = BABYLON.Scalar.Lerp(UFO_CONFIG.startPosition.x, path[0].x, easedProgress);
                currentUfo.position.y = BABYLON.Scalar.Lerp(UFO_CONFIG.startPosition.y, path[0].y, easedProgress);

                if (progress >= 1) {
                    phase = 'flying';
                    currentPointIndex = 1;
                    timeAtPoint = 0;
                }
            }
            else if (phase === 'flying') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / config.timePerPoint, 1);
                const easedProgress = smoothStep(progress);

                const fromPoint = path[currentPointIndex - 1];
                const toPoint = path[currentPointIndex];

                currentUfo.position.x = BABYLON.Scalar.Lerp(fromPoint.x, toPoint.x, easedProgress);
                currentUfo.position.y = BABYLON.Scalar.Lerp(fromPoint.y, toPoint.y, easedProgress);

                if (progress >= 1) {
                    if (shotsFired < config.totalShots && currentPointIndex <= config.pathPoints - 2) {
                        shootProjectiles(currentUfo.position.clone(), config.projectileSpeed);
                        shotsFired++;
                    }

                    currentPointIndex++;
                    timeAtPoint = 0;

                    if (currentPointIndex >= path.length) {
                        phase = 'exiting';
                    }
                }
            }
            else if (phase === 'exiting') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / config.exitDuration, 1);
                const easedProgress = smoothStep(progress);

                const lastPoint = path[path.length - 1];
                currentUfo.position.x = BABYLON.Scalar.Lerp(lastPoint.x, UFO_CONFIG.startPosition.x, easedProgress);
                currentUfo.position.y = BABYLON.Scalar.Lerp(lastPoint.y, UFO_CONFIG.startPosition.y, easedProgress);

                if (progress >= 1) {
                    scene.onBeforeRenderObservable.remove(flyingAnimation);
                    flyingAnimation = null;
                    isFlying = false;

                    currentUfo.position.set(UFO_CONFIG.startPosition.x, UFO_CONFIG.startPosition.y, UFO_CONFIG.startPosition.z);
                    currentUfoMeshes.forEach(mesh => {
                        mesh.rotation.x = BABYLON.Tools.ToRadians(UFO_CONFIG.rotation.default);
                    });

                    if (onComplete) {
                        onComplete();
                    }
                }
            }
        });
    };

    return {
        mesh: currentUfo,
        flyUFO,
        loadNewModel,
        isFlying: () => isFlying
    };
};
