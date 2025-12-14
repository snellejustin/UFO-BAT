import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';

const UFO_CONFIG = {
    startPosition: new BABYLON.Vector3(0, 20, 0),
    rotation: { default: -45, min: -70, max: -40 },
    pathPoints: 5,
    pathXRange: { min: -8, max: 8 },
    pathYRange: { min: 4, max: 7 },
    rotationSpeed: 0.001,
    bossHitboxDiameter: 4.0,
    bossPhysics: { mass: 0, restitution: 0.1, friction: 0 },
    glowIntensity: 1.0
};

const smoothStep = (t) => t * t * (3 - 2 * t);

export const createUFO = async (scene, projectileManager) => {

    const ufoAssets = new Map();
    let currentActiveUfo = null;
    let isFlying = false;
    let flyingObserver = null;

    // Variabelen voor Boss state
    let bossHealth = 3;
    let bossHealthUI = null;

    const createBossHealthUI = (maxHealth) => {
        const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("BossHealthUI", true, scene);
        
        const panel = new GUI.StackPanel();
        panel.isVertical = false;
        panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.top = "50px";
        panel.height = "60px";
        advancedTexture.addControl(panel);

        const bossHeart = [];
        for (let i = 0; i < maxHealth; i++) {
            const heart = new GUI.Ellipse();
            heart.width = "40px";
            heart.height = "40px";
            heart.color = "white";
            heart.thickness = 2;
            heart.background = "red";
            // heart.paddingLeft = "10px";
            // heart.paddingRight = "10px";
            panel.addControl(heart);
            bossHeart.push(heart);
        }

        return {
            update: (currentHealth) => {
                bossHeart.forEach((heart, index) => {
                    // Note: bossHeart are added 0, 1, 2. 
                    // If health is 2, we want index 0 and 1 to be red, index 2 to be gray.
                    // Actually, usually health bars deplete from right to left or top to bottom.
                    // If we want to show "lives lost", turning the last one gray makes sense.
                    if (index < currentHealth) {
                        heart.background = "red";
                    } else {
                        heart.background = "gray";
                    }
                });
            },
            dispose: () => {
                advancedTexture.dispose();
            }
        };
    };

    const modelFiles = ["ufoalien1.glb", "ufoalien2.glb", "ufoalien3.glb", "ufoalien4.glb", "ufoalienboss.glb"];

    await Promise.all(modelFiles.map(async (filename) => {
        const isBoss = filename === "ufoalienboss.glb";
        let visualResult, hitboxResult;

        if (isBoss) {
            [visualResult, hitboxResult] = await Promise.all([
                BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", filename, scene),
                BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "ufoalienboss-hitbox.glb", scene)
            ]);
        } else {
            visualResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", filename, scene);
        }

        let ufoRoot;

        if (isBoss && hitboxResult) {
            const collisionMeshes = hitboxResult.meshes.filter(m => m.getTotalVertices() > 0);
            const mergedHitbox = BABYLON.Mesh.MergeMeshes(collisionMeshes, true, true, undefined, false, false);

            if (mergedHitbox) {
                ufoRoot = mergedHitbox;
                ufoRoot.name = "boss_hitbox";
                ufoRoot.isVisible = false;

                ufoRoot.physicsImpostor = new BABYLON.PhysicsImpostor(
                    ufoRoot,
                    BABYLON.PhysicsImpostor.MeshImpostor,
                    UFO_CONFIG.bossPhysics,
                    scene
                );

                // Forceer kinematic type
                if (ufoRoot.physicsImpostor.physicsBody) {
                    ufoRoot.physicsImpostor.physicsBody.type = 4; // Kinematic
                    ufoRoot.physicsImpostor.physicsBody.updateMassProperties();
                }

            } else {
                console.error("Failed to merge boss hitbox!");
                ufoRoot = new BABYLON.TransformNode(`ufo_root_${filename}`, scene);
            }
        } else {
            ufoRoot = new BABYLON.TransformNode(`ufo_root_${filename}`, scene);
        }

        const visualRoot = visualResult.meshes[0];
        visualRoot.parent = ufoRoot;
        visualRoot.position.setAll(0);
        ufoRoot.position.copyFrom(UFO_CONFIG.startPosition);
        ufoRoot.setEnabled(false);

        const childMeshes = visualResult.meshes.filter(m => m !== visualRoot);
        ufoAssets.set(filename, { root: ufoRoot, visuals: childMeshes });
    }));

    currentActiveUfo = ufoAssets.get("ufoalien1.glb");

    const setModel = (modelFilename) => {
        if (isFlying) return;
        if (currentActiveUfo) currentActiveUfo.root.setEnabled(false);

        if (ufoAssets.has(modelFilename)) {
            currentActiveUfo = ufoAssets.get(modelFilename);
            currentActiveUfo.root.setEnabled(true);
            currentActiveUfo.root.position.copyFrom(UFO_CONFIG.startPosition);

            if (currentActiveUfo.root.physicsImpostor) {
                currentActiveUfo.root.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                currentActiveUfo.root.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                currentActiveUfo.root.physicsImpostor.forceUpdate();
            }

            currentActiveUfo.visuals.forEach(m =>
                m.rotation.x = BABYLON.Tools.ToRadians(UFO_CONFIG.rotation.default)
            );
        }
    };

    // --- NIEUWE STOP FUNCTIE ---
    // Stopt de update loop, maar laat de UFO staan (bevroren)
    const stop = () => {
        if (flyingObserver) {
            scene.onBeforeRenderObservable.remove(flyingObserver);
            flyingObserver = null;
        }

        if (currentActiveUfo && currentActiveUfo._collisionObserver) {
            scene.onBeforeRenderObservable.remove(currentActiveUfo._collisionObserver);
            currentActiveUfo._collisionObserver = null;
        }

        if (bossHealthUI) {
            bossHealthUI.dispose();
            bossHealthUI = null;
        }

        isFlying = false;

        // Zorg dat hij fysiek stilstaat
        if (currentActiveUfo && currentActiveUfo.root.physicsImpostor) {
            currentActiveUfo.root.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
            currentActiveUfo.root.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
        }
    };

    const reset = () => {
        stop(); // Gebruik stop om eerst alles netjes te killen

        // Reset modellen
        ufoAssets.forEach((asset) => {
            asset.root.setEnabled(false);
            asset.root.position.copyFrom(UFO_CONFIG.startPosition);
            if (asset.root.physicsImpostor) {
                asset.root.physicsImpostor.sleep();
                const body = asset.root.physicsImpostor.physicsBody;
                if (body) {
                    body.collisionFilterMask = 0; // Bots nergens mee
                    body.velocity.set(0, 0, 0);
                }
            }
        });

        bossHealth = 3;
        currentActiveUfo = ufoAssets.get("ufoalien1.glb");
    };

    const flyUFO = (onComplete, difficultyConfig = {}) => {
        if (isFlying || !currentActiveUfo) return;

        isFlying = true;
        currentActiveUfo.root.setEnabled(true);

        const isBoss = currentActiveUfo === ufoAssets.get("ufoalienboss.glb");
        bossHealth = 3;

        if (isBoss) {
            if (bossHealthUI) bossHealthUI.dispose();
            bossHealthUI = createBossHealthUI(bossHealth);
        }

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

        if (isBoss && currentActiveUfo.root.physicsImpostor && projectileManager) {
            const bossImpostor = currentActiveUfo.root.physicsImpostor;

            const body = bossImpostor.physicsBody;
            if (body) {
                body.collisionFilterMask = -1;
            }
            bossImpostor.wakeUp();

            const onProjectileHitBoss = (projImpostor, bossImpostor) => {
                const projMesh = projImpostor.object;

                if (projMesh.isHit || !projMesh.isEnabled()) return;

                const vel = projImpostor.getLinearVelocity();

                if (vel && vel.y > -1 && bossHealth > 0) {

                    projectileManager.removeProjectile(projMesh);

                    bossHealth--;
                    console.log(`BOSS HIT! Health remaining: ${bossHealth}`);

                    if (bossHealthUI) {
                        bossHealthUI.update(bossHealth);
                    }

                    if (currentActiveUfo.visuals) {
                        currentActiveUfo.visuals.forEach(m => {
                            if (m.material) {
                                const oldColor = m.material.emissiveColor.clone();
                                m.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
                                setTimeout(() => {
                                    if (m.material) m.material.emissiveColor = oldColor;
                                }, 100);
                            }
                        });
                    }

                    if (bossHealth <= 0) {
                        if (bossHealthUI) {
                            bossHealthUI.dispose();
                            bossHealthUI = null;
                        }
                        const currentPos = currentActiveUfo.root.position;
                        path.length = 0;
                        path.push(new BABYLON.Vector2(currentPos.x, currentPos.y));
                        phase = 'exiting';
                        timeAtPoint = 0;
                        shotsFired = 999;
                    }
                }
            };

            const collisionObserver = scene.onBeforeRenderObservable.add(() => {
                if (!projectileManager.projectiles) return;

                projectileManager.projectiles.forEach((proj) => {
                    if (proj.active && proj.mesh.physicsImpostor) {
                        if (!proj.bossCollisionRegistered) {
                            proj.bossCollisionRegistered = true;
                            proj.mesh.physicsImpostor.registerOnPhysicsCollide(bossImpostor, onProjectileHitBoss);
                        }
                    }
                });
            });

            currentActiveUfo._collisionObserver = collisionObserver;
        }

        const shootProjectiles = (position, speed) => {
            if (!projectileManager) return;
            const angleRad = BABYLON.Tools.ToRadians(30);
            const createVelocity = (angleMultiplier) => new BABYLON.Vector3(
                Math.sin(angleRad * angleMultiplier) * Math.abs(speed),
                Math.cos(angleRad * angleMultiplier) * speed,
                0
            );

            if (config.shootingPattern === "spread") {
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(-1));
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(1));
            }
            else if (config.shootingPattern === "tripleSpread") {
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(-1));
                projectileManager.shootProjectile(position.clone(), speed);
                projectileManager.shootProjectile(position.clone(), speed, createVelocity(1));
            }
            else {
                projectileManager.shootProjectile(position, speed);
            }
        };

        flyingObserver = scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime();
            rotationTime += dt;

            // Wobble
            const sineWave = Math.sin(rotationTime * UFO_CONFIG.rotationSpeed);
            const rotationProgress = smoothStep((sineWave + 1) / 2);
            const rotationAngle = BABYLON.Scalar.Lerp(UFO_CONFIG.rotation.min, UFO_CONFIG.rotation.max, rotationProgress);

            currentActiveUfo.visuals.forEach(mesh => {
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
                startPos = path[path.length - 1] || UFO_CONFIG.startPosition;
                targetPos = UFO_CONFIG.startPosition;
                duration = config.exitDuration;
            }

            timeAtPoint += dt;
            currentProgress = Math.min(timeAtPoint / duration, 1);
            const easedProgress = smoothStep(currentProgress);

            currentActiveUfo.root.position.x = BABYLON.Scalar.Lerp(startPos.x, targetPos.x, easedProgress);
            currentActiveUfo.root.position.y = BABYLON.Scalar.Lerp(startPos.y, targetPos.y, easedProgress);

            if (currentActiveUfo.root.physicsImpostor) {
                currentActiveUfo.root.physicsImpostor.forceUpdate();
            }

            if (currentProgress >= 1) {
                timeAtPoint = 0;

                if (phase === 'entering') {
                    phase = 'flying';
                    currentPointIndex = 1;
                }
                else if (phase === 'flying') {
                    if (shotsFired < config.totalShots && currentPointIndex <= config.pathPoints - 2) {
                        shootProjectiles(currentActiveUfo.root.position.clone(), config.projectileSpeed);
                        shotsFired++;
                    }

                    currentPointIndex++;
                    if (currentPointIndex >= path.length) {
                        if (isBoss && bossHealth > 0) {
                            path.reverse();
                            currentPointIndex = 1;
                        } else {
                            phase = 'exiting';
                        }
                    }
                }
                else if (phase === 'exiting') {
                    reset();
                    if (onComplete) onComplete();
                }
            }
        });
    };

    return {
        flyUFO,
        setModel,
        reset,
        stop, // Exporteer stop
        isFlying: () => isFlying
    };
};