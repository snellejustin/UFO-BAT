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

export const createHealthBoost = (scene, rocketship, healthManager, camera, audioEngine) => {
    let powerup = null;
    let healthBoostModel = null;
    let isModelLoaded = false;
    let updateObserver = null;
    let collisionCallback = null;
    let registeredImpostorId = null;
    let pickupSound = null;

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("healthBoostUI", true, scene);

    const loadSounds = async () => {
        try {
            pickupSound = await BABYLON.CreateSoundAsync("pickupSound", "assets/sounds/power-up_pickup.mp3", {
                loop: false,
                autoplay: false,
                volume: 0.7
            });
        } catch (e) {
            console.error("Failed to load health boost pickup sound:", e);
        }
    };
    loadSounds();

    const handleCollision = async () => {
        if (powerup) {
            if (pickupSound) {
                if (audioEngine && audioEngine.audioContext?.state === 'suspended') {
                    audioEngine.audioContext.resume();
                }
                pickupSound.play();
            }

            const currentHealth = healthManager.getHealth();
            const newHealth = Math.min(HEALTH_BOOST_CONFIG.maxHealth, currentHealth + HEALTH_BOOST_CONFIG.healAmount);
            healthManager.setHealth(newHealth);

            showHealPopup(newHealth - currentHealth, camera);

            const powerupToRemove = powerup;
            powerup = null;

            //niet meerdere keren getriggerd kan worden
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionCallback && powerupToRemove.physicsImpostor && collisionMesh.physicsImpostor) {
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
            healthBoostModel.setEnabled(false)

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load health boost model:", error);
        }
    };

    loadHealthBoostModel();

    const isSafeSpawnPosition = (x, asteroidSystem) => {
        if (!asteroidSystem?.manager?.active) return true;
        const minSafeDistance = 4;
        const minSafeDistanceX = 3;

        for (const asteroid of asteroidSystem.manager.active) {
            const asteroidX = asteroid.position.x;
            const asteroidY = asteroid.position.y;
            if (asteroidY > HEALTH_BOOST_CONFIG.spawnHeight - 4 &&
                asteroidY < HEALTH_BOOST_CONFIG.spawnHeight + 4) {
                const distance = Math.abs(asteroidX - x);
                if (distance < minSafeDistance) return false;
            }

            if (Math.abs(asteroidX - x) < minSafeDistanceX) return false;
        }
        return true;
    };

    const spawnPowerup = (asteroidSystem = null) => {
        if (!isModelLoaded) return;

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

        let spawnX = 0;
        let attempts = 0;
        const maxAttempts = 10;
        do {
            spawnX = (Math.random() - 0.5) * HEALTH_BOOST_CONFIG.spawnWidthRange;
            attempts++;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem) && attempts < maxAttempts);

        visualMesh.position.set(spawnX, HEALTH_BOOST_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            HEALTH_BOOST_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, HEALTH_BOOST_CONFIG.fallSpeed, 0));

        //koppel hitbox aan visual mesh
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };

        powerup = visualMesh;

        //check voor hitbox van rocketship te krijgen, anders gewoon rocketship zelf gebruiken
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        if (collisionMesh.physicsImpostor) {
            registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
            collisionCallback = handleCollision;
            //registreer collision van rocketship met hitbox van powerup
            collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, collisionCallback);
        }
    };

    const showHealPopup = (amount) => {
        const textBlock = new GUI.TextBlock();
        textBlock.text = `+${amount}`;
        textBlock.color = HEALTH_BOOST_CONFIG.popup.color;
        textBlock.fontSize = 40;
        textBlock.fontFamily = "GameFont, Arial, sans-serif";
        textBlock.fontWeight = "bold";
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = "black";

        guiTexture.addControl(textBlock);

        textBlock.linkWithMesh(rocketship);
        textBlock.linkOffsetY = -100;

        let alpha = 1.0;
        let offset = -100;

        const observer = scene.onBeforeRenderObservable.add(() => {
            offset -= 2;
            alpha -= 0.02;

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
        if (!powerup) return;

        const hitbox = powerup.metadata?.hitbox;

        //check for dynamic hitbox changes
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
        if (collisionMesh.physicsImpostor && collisionMesh.physicsImpostor.uniqueId !== registeredImpostorId) {
             registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
             collisionCallback = handleCollision;
             collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, collisionCallback);
        }

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