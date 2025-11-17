import * as BABYLON from '@babylonjs/core';

export const createUFO = (scene, projectileManager) => {
    const ufo = BABYLON.MeshBuilder.CreateSphere('ufo', { diameterY: 0.2, size: 0.3 }, scene);
    ufo.position.set(0, 15, 0);
    
    let isFlying = false;
    let flyingAnimation = null;

    const generateRandomPath = () => {
        const path = [];
        for (let i = 0; i < 5; i++) {
            path.push({
                x: Math.random() * 16 - 8,
                y: Math.random() * 3 + 4
            });
        }
        return path;
    };

    const flyUFO = (onComplete) => {
        if (isFlying) return;
        
        isFlying = true;
        const path = generateRandomPath();
        
        let currentPointIndex = 0;
        let timeAtPoint = 0;
        const timePerPoint = 2000;
        let shotsFired = 0;
        const totalShots = 3;
        const shootInterval = path.length / totalShots;

        let phase = 'entering';
        let enterTime = 0;
        const enterDuration = 2000;

        flyingAnimation = scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime();

            if (phase === 'entering') {
                enterTime += dt;
                const progress = Math.min(enterTime / enterDuration, 1);
                ufo.position.y = 15 - (15 - path[0].y) * progress;
                ufo.position.x = path[0].x * progress;

                if (progress >= 1) {
                    phase = 'flying';
                    currentPointIndex = 1;
                }
            }
            else if (phase === 'flying') {
                timeAtPoint += dt;
                const progress = Math.min(timeAtPoint / timePerPoint, 1);

                const fromPoint = path[currentPointIndex - 1];
                const toPoint = path[currentPointIndex];

                ufo.position.x = fromPoint.x + (toPoint.x - fromPoint.x) * progress;
                ufo.position.y = fromPoint.y + (toPoint.y - fromPoint.y) * progress;

                if (progress >= 1) {
                    if (projectileManager && shotsFired < totalShots) {
                        if (currentPointIndex === 1 || currentPointIndex === 2 || currentPointIndex === 3) {
                            projectileManager.shootProjectile(ufo.position);
                            shotsFired++;
                            console.log(`Shot ${shotsFired} fired at waypoint ${currentPointIndex + 1}`);
                        }
                    }

                    currentPointIndex++;
                    timeAtPoint = 0;

                    if (currentPointIndex >= path.length) {
                        phase = 'exiting';
                        timeAtPoint = 0;
                    }
                }
            }
            else if (phase === 'exiting') {
                timeAtPoint += dt;
                const exitDuration = 1000;
                const progress = Math.min(timeAtPoint / exitDuration, 1);

                const lastPoint = path[path.length - 1];
                ufo.position.x = lastPoint.x + (0 - lastPoint.x) * progress;
                ufo.position.y = lastPoint.y + (15 - lastPoint.y) * progress;

                if (progress >= 1) {
                    // Animation complete
                    scene.onBeforeRenderObservable.remove(flyingAnimation);
                    flyingAnimation = null;
                    isFlying = false;
                    
                    // Reset position
                    ufo.position.set(0, 15, 0);
                    
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
