import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';

const HEALTH_BOOST_CONFIG = {
    scale: 0.7,
    spawnHeight: 15,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2,
    hitboxDiameter: 1,
    healAmount: 50,
    maxHealth: 100,
    despawnHeight: -5,
    physics: {
        mass: 1,
        restitution: 0.5,
        friction: 0.3
    },
    popup: {
        color: '#00FF00',
        fontSize: '32px',
        yOffset: -30,
        duration: 1000
    },
    color: {
        emissive: new BABYLON.Color3(0, 0.2, 0.5)
    },
};

export const createHealthBoost = (scene, rocketship, healthManager, camera) => {
    let powerup = null;
    let healthBoostModel = null;
    let isModelLoaded = false;
    let updateObserver = null;
    let collisionCallback = null;

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("healthBoostUI", true, scene);

    const loadHealthBoostModel = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "heartpowerup1.glb",
                scene
            );

            //mesh zoeken en opslaan
            healthBoostModel = result.meshes[0];
            healthBoostModel.name = "healthBoost_source";
            healthBoostModel.setEnabled(false);

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load health boost model:", error);
        }
    };

    loadHealthBoostModel();

    const isSafeSpawnPosition = (x, asteroidSystem) => {
        if (!asteroidSystem?.manager?.active) return true;
        const minSafeDistance = 4;
        for (const asteroid of asteroidSystem.manager.active) {
            const asteroidX = asteroid.position.x;
            const asteroidY = asteroid.position.y;
            if (asteroidY > HEALTH_BOOST_CONFIG.spawnHeight - 4 &&
                asteroidY < HEALTH_BOOST_CONFIG.spawnHeight + 4) {
                const distance = Math.abs(asteroidX - x);
                if (distance < minSafeDistance) return false;
            }
        }
        return true;
    };

    // Helper: isStatic = true for practice mode (no falling, mass 0)
    const createPowerupMesh = (xPosition, yPosition, isStatic = false) => {
        const visualMesh = healthBoostModel.clone('healthBoost_visual');
        visualMesh.setEnabled(true);
        visualMesh.scaling.setAll(HEALTH_BOOST_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        //clone alle child meshes
        healthBoostModel.getChildMeshes().forEach(childMesh => {
            const clonedChild = childMesh.clone(childMesh.name + '_clone');
            clonedChild.parent = visualMesh;
            clonedChild.setEnabled(true);
        });

        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "healthBoostHitbox",
            { diameter: HEALTH_BOOST_CONFIG.hitboxDiameter },
            scene
        );
        hitbox.isVisible = false;

        visualMesh.position.set(xPosition, yPosition, 0);
        hitbox.position.copyFrom(visualMesh.position);

        // Physics config: Mass 0 if static
        const physicsConfig = isStatic
            ? { ...HEALTH_BOOST_CONFIG.physics, mass: 0 }
            : HEALTH_BOOST_CONFIG.physics;

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            physicsConfig,
            scene
        );

        // Apply velocity only if not static
        if (!isStatic) {
            hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, HEALTH_BOOST_CONFIG.fallSpeed, 0));
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
            spawnX = (Math.random() - 0.5) * HEALTH_BOOST_CONFIG.spawnWidthRange;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem));

        powerup = createPowerupMesh(spawnX, HEALTH_BOOST_CONFIG.spawnHeight, false);

        //check voor hitbox van rocketship te krijgen, anders gewoon rocketship zelf gebruiken
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionCallback = () => {
            if (powerup) {
                const currentHealth = healthManager.getHealth();
                const newHealth = Math.min(HEALTH_BOOST_CONFIG.maxHealth, currentHealth + HEALTH_BOOST_CONFIG.healAmount);
                healthManager.setHealth(newHealth);

                showHealPopup(newHealth - currentHealth, camera);

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
        if (collisionCallback && powerupToRemove.metadata?.hitbox?.physicsImpostor) {
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

    const showHealPopup = (amount) => {
        createFloatingText(`+${amount}`, HEALTH_BOOST_CONFIG.popup.color);
    };

    const showTutorialPopup = (text) => {
        createFloatingText(text, "#FFFFFF", 50);
    };

    const createFloatingText = (text, color, fontSize = 40) => {
        const textBlock = new GUI.TextBlock();
        textBlock.text = text;
        textBlock.color = color;
        textBlock.fontSize = fontSize;
        textBlock.fontWeight = "bold";
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = "black";

        guiTexture.addControl(textBlock);

        textBlock.linkWithMesh(rocketship);
        textBlock.linkOffsetY = -100;

        let alpha = 1.0;
        let offset = -100;

        const observer = scene.onBeforeRenderObservable.add(() => {
            offset -= 1;
            alpha -= 0.015;

            textBlock.linkOffsetY = offset;
            textBlock.alpha = alpha;

            //tekst en observer verwijderen als volledig transparant
            if (alpha <= 0) {
                guiTexture.removeControl(textBlock);
                textBlock.dispose();
                scene.onBeforeRenderObservable.remove(observer);
            }
        });
    };

    //voor safety oude observer verwijderen
    if (updateObserver) {
        scene.onBeforeRenderObservable.remove(updateObserver);
    }

    const reset = () => {
        cleanupPowerup();
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
        }
    };

    if (updateObserver) {
        scene.onBeforeRenderObservable.remove(updateObserver);
    }

    updateObserver = scene.onBeforeRenderObservable.add(() => {
        if (!powerup) return;

        const hitbox = powerup.metadata?.hitbox;
        if (hitbox) {
            //synchroniseer positie
            powerup.position.copyFrom(hitbox.position);
            powerup.rotation.y += 0.03;

            //despawn als hij te laag komt
            if (hitbox.position.y < HEALTH_BOOST_CONFIG.despawnHeight) {
                reset();
            }
        }
    });

    const cleanup = () => {
        reset();
        if (guiTexture) guiTexture.dispose();
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
            updateObserver = null;
        }
    };

    return {
        spawnPowerup,
        reset,
        cleanup
    };
}