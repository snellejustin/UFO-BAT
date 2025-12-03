import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';

const SHIELD_CONFIG = {
    scale: 0.7,
    spawnHeight: 15,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2,
    hitboxDiameter: 1,
    duration: 10000,
    despawnHeight: -5,
    color: {
        emissive: new BABYLON.Color3(0, 0.2, 0.5)
    },
    physics: {
        mass: 1,
        restitution: 0.5,
        friction: 0.3
    },
    popup: {
        text: 'SHIELD ACTIVE',
        color: '#00BFFF',
        fontSize: 28,
        yOffset: -50,
        duration: 1000
    },
    timer: {
        fontSize: 24,
        color: '#00BFFF',
        position: { top: '120px', right: '40px' }
    }
};

export const createShield = (scene, rocketship, camera) => {
    let powerup = null;
    let shieldModel = null;
    let isModelLoaded = false;
    let isShieldActive = false;

    let shieldTimerObserver = null;
    let timerElement = null;

    let updateObserver = null;
    let collisionCallback = null;

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("shieldUI", true, scene);

    const loadShieldModel = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "shieldpowerup3.glb",
                scene
            );

            //mesh zoeken en opslaan
            shieldModel = result.meshes[0];
            shieldModel.name = "shield_source";
            shieldModel.setEnabled(false);

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load shield model:", error);
        }
    };

    loadShieldModel();

    const isSafeSpawnPosition = (x, asteroidSystem) => {
        if (!asteroidSystem?.manager?.active) return true;
        const minSafeDistance = 4;
        for (const asteroid of asteroidSystem.manager.active) {
            const asteroidX = asteroid.position.x;
            const asteroidY = asteroid.position.y;
            if (asteroidY > SHIELD_CONFIG.spawnHeight - 4 &&
                asteroidY < SHIELD_CONFIG.spawnHeight + 4) {
                const distance = Math.abs(asteroidX - x);
                if (distance < minSafeDistance) return false;
            }
        }
        return true;
    };

    const spawnPowerup = (asteroidSystem = null) => {
        if (!isModelLoaded) return;

        //instantiateHierarchy in plaats van clone + loop.
        //behoudt de parent-child structuur van het complexe shield model.
        const visualMesh = shieldModel.instantiateHierarchy();
        visualMesh.name = 'shield_visual';
        visualMesh.setEnabled(true);

        visualMesh.scaling.setAll(SHIELD_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "shieldHitbox",
            { diameter: SHIELD_CONFIG.hitboxDiameter },
            scene
        );
        hitbox.isVisible = false;

        let spawnX = 0;
        do {
            spawnX = (Math.random() - 0.5) * SHIELD_CONFIG.spawnWidthRange;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem));

        visualMesh.position.set(spawnX, SHIELD_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            SHIELD_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, SHIELD_CONFIG.fallSpeed, 0));

        //koppel hitbox aan visual mesh
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };

        powerup = visualMesh;

        //check voor hitbox van rocketship te krijgen, anders gewoon rocketship zelf gebruiken
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionCallback = () => {
            if (powerup) {
                activateShield();
                showShieldPopup();

                const powerupToRemove = powerup;
                powerup = null;

                //niet meerdere keren getriggerd kan worden
                if (collisionMesh.physicsImpostor && powerupToRemove.physicsImpostor) {
                    collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.physicsImpostor, collisionCallback);
                }
                collisionCallback = null;

                //veilig verwijderen
                scene.onAfterPhysicsObservable.addOnce(() => {
                    const hitboxToDispose = powerupToRemove.metadata?.hitbox;
                    if (hitboxToDispose) {
                        if (hitboxToDispose.physicsImpostor) hitboxToDispose.physicsImpostor.dispose();
                        hitboxToDispose.dispose();
                    }
                    powerupToRemove.dispose();
                });
            }
        };
        //registreer collision van rocketship met hitbox van powerup
        collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, collisionCallback);
    };

    const activateShield = () => {
        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        isShieldActive = true;
        let timeRemaining = SHIELD_CONFIG.duration / 1000;

        createShieldTimerUI();

        //babylon timer loop
        shieldTimerObserver = scene.onBeforeRenderObservable.add(() => {
            //berekenen tijd via engine delta time (soepeler)
            const dt = scene.getEngine().getDeltaTime() / 1000;
            timeRemaining -= dt;

            if (timerElement) {
                timerElement.text = `Shield ${Math.ceil(timeRemaining)}s`;
            }
            if (timeRemaining <= 0) {
                deactivateShield();
            }
        });
    };

    const deactivateShield = () => {
        isShieldActive = false;

        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        //verwijder UI
        if (timerElement) {
            guiTexture.removeControl(timerElement);
            timerElement.dispose();
            timerElement = null;
        }
    };

    const createShieldTimerUI = () => {
        //oude opruimen voor de zekerheid
        if (timerElement) {
            guiTexture.removeControl(timerElement);
            timerElement.dispose();
        }

        timerElement = new GUI.TextBlock();
        timerElement.color = SHIELD_CONFIG.timer.color;
        timerElement.fontSize = SHIELD_CONFIG.timer.fontSize;
        timerElement.fontWeight = "bold";

        timerElement.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        timerElement.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        timerElement.top = SHIELD_CONFIG.timer.position.top;
        timerElement.left = `-${SHIELD_CONFIG.timer.position.right}`;

        //startwaarde
        timerElement.text = `Shield ${SHIELD_CONFIG.duration / 1000}s`;

        guiTexture.addControl(timerElement);
    };

    const showShieldPopup = () => {
        const textBlock = new GUI.TextBlock();
        textBlock.text = SHIELD_CONFIG.popup.text;
        textBlock.color = SHIELD_CONFIG.popup.color;
        textBlock.fontSize = SHIELD_CONFIG.popup.fontSize;
        textBlock.fontWeight = "bold";
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = "black";

        guiTexture.addControl(textBlock);

        textBlock.linkWithMesh(rocketship);
        textBlock.linkOffsetY = SHIELD_CONFIG.popup.yOffset;

        let alpha = 1.0;
        let offset = SHIELD_CONFIG.popup.yOffset;

        const observer = scene.onBeforeRenderObservable.add(() => {
            offset -= 2;
            alpha -= 0.02;

            textBlock.linkOffsetY = offset;
            textBlock.alpha = alpha;

            if (alpha <= 0) {
                guiTexture.removeControl(textBlock);
                textBlock.dispose();
                scene.onBeforeRenderObservable.remove(observer);
            }
        });
    };

    //reset functie voor level restarts
    const reset = () => {
        //stop de babylon timer observer
        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        if (timerElement) {
            guiTexture.removeControl(timerElement);
            timerElement.dispose();
            timerElement = null;
        }

        deactivateShield();

        if (powerup) {
            const powerupToRemove = powerup;
            powerup = null;

            //stop de engine voor collisions te watchen
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionCallback && powerupToRemove.physicsImpostor) {
                collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.physicsImpostor, collisionCallback);
            }
            collisionCallback = null;

            //veilig verwijderen
            scene.onAfterPhysicsObservable.addOnce(() => {
                const hitboxToDispose = powerupToRemove.metadata?.hitbox;
                if (hitboxToDispose) {
                    if (hitboxToDispose.physicsImpostor) hitboxToDispose.physicsImpostor.dispose();
                    hitboxToDispose.dispose();
                }
                powerupToRemove.dispose();
            });
        }
    };

    if (updateObserver) {
        scene.onBeforeRenderObservable.remove(updateObserver);
    }

    updateObserver = scene.onBeforeRenderObservable.add(() => {
        if (powerup) {
            const hitbox = powerup.metadata?.hitbox;
            if (hitbox) {
                //synchroniseer positie
                powerup.position.copyFrom(hitbox.position);
                powerup.rotation.z += 0.03;

                //despawn als hij te laag komt
                if (hitbox.position.y < SHIELD_CONFIG.despawnHeight) {
                    reset();
                }
            }
            
        }
    });

    const cleanup = () => {
        reset();
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
            updateObserver = null;
        }
        if (guiTexture) {
            guiTexture.dispose();
        }
    };

    return {
        spawnPowerup,
        isShieldActive: () => isShieldActive,
        reset,
        cleanup
    };
}