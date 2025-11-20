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

export const createUFO = async (scene, projectileManager) => {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/blender-models/",
        "ufo.glb",
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

    const generateRandomPath = () => {
        const path = [];
        for (let i = 0; i < UFO_CONFIG.pathPoints; i++) {
            path.push(new BABYLON.Vector2(
                Math.random() * (UFO_CONFIG.pathXRange.max - UFO_CONFIG.pathXRange.min) + UFO_CONFIG.pathXRange.min,
                Math.random() * (UFO_CONFIG.pathYRange.max - UFO_CONFIG.pathYRange.min) + UFO_CONFIG.pathYRange.min
            ));
        }
        return path;
    };

    const flyUFO = (onComplete) => {
        if (isFlying) return;

        isFlying = true;
        const path = generateRandomPath();

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
            setUFORotation(rotationAngle);

            if (phase === 'entering') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / UFO_CONFIG.enterDuration, 1);
                const easedProgress = smoothStep(progress);
                ufo.position.x = BABYLON.Scalar.Lerp(UFO_CONFIG.startPosition.x, path[0].x, easedProgress);
                ufo.position.y = BABYLON.Scalar.Lerp(UFO_CONFIG.startPosition.y, path[0].y, easedProgress);

                if (progress >= 1) {
                    phase = 'flying';
                    currentPointIndex = 1;
                    timeAtPoint = 0;
                }
            }
            else if (phase === 'flying') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / UFO_CONFIG.timePerPoint, 1);
                const easedProgress = smoothStep(progress);

                const fromPoint = path[currentPointIndex - 1];
                const toPoint = path[currentPointIndex];

                ufo.position.x = BABYLON.Scalar.Lerp(fromPoint.x, toPoint.x, easedProgress);
                ufo.position.y = BABYLON.Scalar.Lerp(fromPoint.y, toPoint.y, easedProgress);

                if (progress >= 1) {
                    if (projectileManager && shotsFired < UFO_CONFIG.totalShots && currentPointIndex <= 3) {
                        projectileManager.shootProjectile(ufo.position.clone());
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
                const progress = Math.min(timeAtPoint / UFO_CONFIG.exitDuration, 1);
                const easedProgress = smoothStep(progress);

                const lastPoint = path[path.length - 1];
                ufo.position.x = BABYLON.Scalar.Lerp(lastPoint.x, UFO_CONFIG.startPosition.x, easedProgress);
                ufo.position.y = BABYLON.Scalar.Lerp(lastPoint.y, UFO_CONFIG.startPosition.y, easedProgress);

                if (progress >= 1) {
                    scene.onBeforeRenderObservable.remove(flyingAnimation);
                    flyingAnimation = null;
                    isFlying = false;

                    ufo.position.set(UFO_CONFIG.startPosition.x, UFO_CONFIG.startPosition.y, UFO_CONFIG.startPosition.z);
                    setUFORotation(UFO_CONFIG.rotation.default);

                    if (onComplete) {
                        onComplete();
                    }
                }
            }
        });
    };

    return {
        mesh: ufo,
        flyUFO,
        isFlying: () => isFlying
    };
};
