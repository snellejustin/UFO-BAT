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

    // Helper: isStatic = true for practice mode
    const createPowerupMesh = (xPosition, yPosition, isStatic = false) => {
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

        visualMesh.position.set(xPosition, yPosition, 0);
        hitbox.position.copyFrom(visualMesh.position);

        const physicsConfig = isStatic
            ? { ...SHIELD_CONFIG.physics, mass: 0 }
            : SHIELD_CONFIG.physics;

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            physicsConfig,
            scene
        );

        if (!isStatic) {
            hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, SHIELD_CONFIG.fallSpeed, 0));
        }

        //koppel hitbox aan visual mesh
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };

        return visualMesh;
    };

    const spawnPowerup = (asteroidSystem = null) => {
        if (!isModelLoaded) return;

        let spawnX = 0;
        do {
            spawnX = (Math.random() - 0.5) * SHIELD_CONFIG.spawnWidthRange;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem));

        powerup = createPowerupMesh(spawnX, SHIELD_CONFIG.spawnHeight, false);

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionCallback = () => {
            if (powerup) {
                activateShield();
                showShieldPopup();

                cleanupPowerup();
            }
        };
        //registreer collision van rocketship met hitbox van powerup
        collisionMesh.physicsImpostor.registerOnPhysicsCollide(powerup.metadata.hitbox.physicsImpostor, collisionCallback);
    };

    const cleanupPowerup = () => {
        if (!powerup) return;

        const powerupToRemove = powerup;
        powerup = null;

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
        if (collisionMesh.physicsImpostor && powerupToRemove.metadata?.hitbox?.physicsImpostor && collisionCallback) {
            collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.metadata.hitbox.physicsImpostor, collisionCallback);
        }
        collisionCallback = null;

        scene.onAfterPhysicsObservable.addOnce(() => {
            const hitboxToDispose = powerupToRemove.metadata?.hitbox;
            if (hitboxToDispose) {
                if (hitboxToDispose.physicsImpostor) hitboxToDispose.physicsImpostor.dispose();
                hitboxToDispose.dispose();
            }
            powerupToRemove.dispose();
        });
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
        createFloatingText(SHIELD_CONFIG.popup.text, SHIELD_CONFIG.popup.color);
    };

    const showTutorialPopup = (text) => {
        createFloatingText(text, "#FFFFFF", 50);
    };

    const createFloatingText = (text, color, fontSize = 28) => {
        const textBlock = new GUI.TextBlock();
        textBlock.text = text;
        textBlock.color = color;
        textBlock.fontSize = fontSize;
        textBlock.fontFamily = "GameFont, Arial, sans-serif";
        textBlock.fontWeight = "bold";
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = "black";

        guiTexture.addControl(textBlock);

        textBlock.linkWithMesh(rocketship);
        textBlock.linkOffsetY = SHIELD_CONFIG.popup.yOffset;

        let alpha = 1.0;
        let offset = SHIELD_CONFIG.popup.yOffset;

        const observer = scene.onBeforeRenderObservable.add(() => {
            offset -= 1;
            alpha -= 0.015;

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
        cleanupPowerup();
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