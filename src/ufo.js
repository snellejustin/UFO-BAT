import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const UFO_CONFIG = {
    startPosition: new BABYLON.Vector3(0, 15, 0),
    rotation: { default: -45, min: -70, max: -40 },
    pathPoints: 5,
    pathXRange: { min: -8, max: 8 },
    pathYRange: { min: 4, max: 7 },
    rotationSpeed: 0.001
};


const smoothStep = (t) => t * t * (3 - 2 * t);

export const createUFO = async (scene, projectileManager) => {

    const ufoAssets = new Map();
    let currentActiveUfo = null;
    let isFlying = false;
    let flyingObserver = null;

    const modelFiles = ["ufoalien1.glb", "ufoalien2.glb", "ufoalien3.glb", "ufoalien4.glb"];

    await Promise.all(modelFiles.map(async (filename) => {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "assets/blender-models/",
            filename,
            scene
        );

        const rootMesh = result.meshes[0];
        rootMesh.name = `ufo_root_${filename}`;

        rootMesh.setEnabled(false);
        rootMesh.position.copyFrom(UFO_CONFIG.startPosition);

        const childMeshes = result.meshes.filter(m => m !== rootMesh);

        childMeshes.forEach(m => m.rotation.x = BABYLON.Tools.ToRadians(UFO_CONFIG.rotation.default));

        ufoAssets.set(filename, { root: rootMesh, children: childMeshes });
    }));

    currentActiveUfo = ufoAssets.get("ufoalien1.glb");

    const setModel = (modelFilename) => {
        if (isFlying) return;

        if (currentActiveUfo) {
            currentActiveUfo.root.setEnabled(false);
        }

        if (ufoAssets.has(modelFilename)) {
            currentActiveUfo = ufoAssets.get(modelFilename);
            currentActiveUfo.root.setEnabled(true);
            currentActiveUfo.root.position.copyFrom(UFO_CONFIG.startPosition);

            currentActiveUfo.children.forEach(m =>
                m.rotation.x = BABYLON.Tools.ToRadians(UFO_CONFIG.rotation.default)
            );
        } else {
            console.error(`Model ${modelFilename} not found in preloaded assets.`);
        }
    };

    const flyUFO = (onComplete, difficultyConfig = {}) => {
        if (isFlying || !currentActiveUfo) return;

        isFlying = true;
        currentActiveUfo.root.setEnabled(true);

        const config = {
            pathPoints: difficultyConfig.pathPoints ?? UFO_CONFIG.pathPoints,
            pathXRange: difficultyConfig.pathXRange ?? UFO_CONFIG.pathXRange,
            pathYRange: difficultyConfig.pathYRange ?? UFO_CONFIG.pathYRange,
            timePerPoint: difficultyConfig.timePerPoint ?? 2000,
            totalShots: difficultyConfig.totalShots ?? 3,
            enterDuration: difficultyConfig.enterDuration ?? 2000,
            exitDuration: difficultyConfig.exitDuration ?? 1000,
            projectileSpeed: difficultyConfig.projectileSpeed ?? -5,
            shootingPattern: difficultyConfig.shootingPattern ?? "single"
        };

        const shootProjectiles = (position, speed) => {
            if (!projectileManager) return;

            const angleRad = BABYLON.Tools.ToRadians(30);

            const createVelocity = (angleMultiplier) => new BABYLON.Vector3(
                Math.sin(angleRad * angleMultiplier) * Math.abs(speed),
                Math.cos(angleRad * angleMultiplier) * speed,
                0
            );

            if (config.shootingPattern === "spread") {
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(-1)); //links
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(1));  //rechts
            }
            else if (config.shootingPattern === "tripleSpread") {
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(-1)); //links
                projectileManager.shootProjectile(position.clone(), speed);                     //midden
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(1));  //rechts
            }
            else {
                projectileManager.shootProjectile(position, speed);
            }
        };

        const path = [];
        for (let i = 0; i < config.pathPoints; i++) {
            path.push(new BABYLON.Vector2(
                BABYLON.Scalar.RandomRange(config.pathXRange.min, config.pathXRange.max),
                BABYLON.Scalar.RandomRange(config.pathYRange.min, config.pathYRange.max)
            ));
        }

        let currentPointIndex = 0;
        let timeAtPoint = 0;
        let shotsFired = 0;
        let phase = 'entering';
        let rotationTime = 0;

        flyingObserver = scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime();
            rotationTime += dt;

            const sineWave = Math.sin(rotationTime * UFO_CONFIG.rotationSpeed);
            const rotationProgress = smoothStep((sineWave + 1) / 2);
            const rotationAngle = BABYLON.Scalar.Lerp(UFO_CONFIG.rotation.min, UFO_CONFIG.rotation.max, rotationProgress);

            currentActiveUfo.children.forEach(mesh => {
                mesh.rotation.x = BABYLON.Tools.ToRadians(rotationAngle);
            });

            let targetPos = null;
            let startPos = null;
            let duration = 0;
            let currentProgress = 0;

            if (phase === 'entering') {
                startPos = UFO_CONFIG.startPosition;
                targetPos = path[0];
                duration = config.enterDuration;
            }
            else if (phase === 'flying') {
                startPos = path[currentPointIndex - 1];
                targetPos = path[currentPointIndex];
                duration = config.timePerPoint;
            }
            else if (phase === 'exiting') {
                startPos = path[path.length - 1];
                targetPos = UFO_CONFIG.startPosition;
                duration = config.exitDuration;
            }

            timeAtPoint += dt;
            currentProgress = Math.min(timeAtPoint / duration, 1);
            const easedProgress = smoothStep(currentProgress);

            currentActiveUfo.root.position.x = BABYLON.Scalar.Lerp(startPos.x, targetPos.x, easedProgress);
            currentActiveUfo.root.position.y = BABYLON.Scalar.Lerp(startPos.y, targetPos.y, easedProgress);

            if (currentProgress >= 1) {
                timeAtPoint = 0;

                if (phase === 'entering') {
                    phase = 'flying';
                    currentPointIndex = 1;
                }
                else if (phase === 'flying') {
                    //shoot
                    if (shotsFired < config.totalShots && currentPointIndex <= config.pathPoints - 2) {
                        shootProjectiles(currentActiveUfo.root.position.clone(), config.projectileSpeed);
                        shotsFired++;
                    }

                    currentPointIndex++;
                    if (currentPointIndex >= path.length) {
                        phase = 'exiting';
                    }
                }
                else if (phase === 'exiting') {
                    //cleanup
                    scene.onBeforeRenderObservable.remove(flyingObserver);
                    flyingObserver = null;
                    isFlying = false;
                    currentActiveUfo.root.setEnabled(false);

                    if (onComplete) onComplete();
                }
            }
        });
    };

    return {
        flyUFO,
        setModel,
        isFlying: () => isFlying
    };
};