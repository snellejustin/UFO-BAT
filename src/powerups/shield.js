import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const SHIELD_CONFIG = {
    scale: 0.5,
    spawnHeight: 20,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2,
    hitboxDiameter: 1,
    duration: 10000,
    flickerInterval: 200,
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
        fontSize: '28px',
        yOffset: -50,
        duration: 1000
    },

    timer: {
        fontSize: '24px',
        color: '#00BFFF',
        position: { top: '120px', right: '40px' }
    }
};

export function createShield(scene, rocketship, camera) {
    let powerup = null;
    let shieldModel = null;
    let isModelLoaded = false;
    let isShieldActive = false;
    let shieldTimeout = null;
    let flickerInterval = null;
    let timerElement = null;
    let timerInterval = null;
    let shieldEndTime = 0;
    let updateObserver = null; // Track observer for cleanup

    const loadShieldModel = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "shieldpowerup3.glb",
                scene
            );

            shieldModel = result.meshes[0];
            shieldModel.name = "shield_source";
            shieldModel.setEnabled(false);

            result.meshes.forEach(mesh => {
                mesh.setEnabled(false);
            });

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load shield model:", error);
        }
    };

    loadShieldModel();

    // Helper function to check if position is safe (no asteroids nearby)
    const isSafeSpawnPosition = (x, asteroidSystem) => {
        if (!asteroidSystem?.manager?.active) return true;
        
        const minSafeDistance = 3; // Minimum distance from asteroids
        
        for (const asteroid of asteroidSystem.manager.active) {
            const asteroidX = asteroid.position.x;
            const asteroidY = asteroid.position.y;
            
            // Check if asteroid is near spawn height and X position
            if (asteroidY > SHIELD_CONFIG.spawnHeight - 3 && 
                asteroidY < SHIELD_CONFIG.spawnHeight + 3) {
                const distance = Math.abs(asteroidX - x);
                if (distance < minSafeDistance) {
                    return false;
                }
            }
        }
        return true;
    };

    const spawnPowerup = (asteroidSystem = null) => {
        console.log('[SHIELD] spawnPowerup called, isModelLoaded:', isModelLoaded);
        if (!isModelLoaded) return;
        
        if (powerup) {
            powerup.dispose();
        }

        //clone the shield model
        const visualMesh = shieldModel.clone('shield_visual');
        visualMesh.setEnabled(true);
        visualMesh.scaling.setAll(SHIELD_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        // console.log('[SHIELD] Visual mesh created:', visualMesh.name, 'rotation:', visualMesh.rotation);

        shieldModel.getChildMeshes().forEach(childMesh => {
            const clonedChild = childMesh.clone(childMesh.name + '_clone');
            clonedChild.parent = visualMesh;
            clonedChild.setEnabled(true);
        });

        //invisible hitbox zoals bij asteroids
        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "shieldHitbox",
            { diameter: SHIELD_CONFIG.hitboxDiameter },
            scene
        );
        hitbox.isVisible = false;

        // Try to find a safe spawn position (max 10 attempts)
        let spawnX = 0;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            spawnX = (Math.random() - 0.5) * SHIELD_CONFIG.spawnWidthRange;
            attempts++;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem) && attempts < maxAttempts);
        
        visualMesh.position.set(spawnX, SHIELD_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            SHIELD_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, SHIELD_CONFIG.fallSpeed, 0));

        //visual en hitbox linken
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };
        
        powerup = visualMesh;

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, () => {
            if (powerup) {
                activateShield();
                showShieldPopup(camera);

                const hitboxToDispose = powerup.metadata?.hitbox;
                if (hitboxToDispose) {
                    hitboxToDispose.dispose();
                }
                powerup.dispose();
                powerup = null;
            }
        });
    };

    const activateShield = () => {
        if (shieldTimeout) clearTimeout(shieldTimeout);
        if (flickerInterval) clearInterval(flickerInterval);
        if (timerInterval) clearInterval(timerInterval);

        isShieldActive = true;
        shieldEndTime = Date.now() + SHIELD_CONFIG.duration;

        const visualMesh = rocketship;
        if (!visualMesh.metadata.originalEmissive) {
            visualMesh.metadata.originalEmissive = visualMesh.material?.emissiveColor?.clone() || new BABYLON.Color3(0, 0, 0);
        }

        let flickerState = false;
        flickerInterval = setInterval(() => {
            if (visualMesh.material) {
                visualMesh.material.emissiveColor = flickerState
                    ? SHIELD_CONFIG.color.emissive
                    : visualMesh.metadata.originalEmissive;
                flickerState = !flickerState;
            }
        }, SHIELD_CONFIG.flickerInterval);

        showShieldTimer();

        shieldTimeout = setTimeout(() => {
            deactivateShield();
        }, SHIELD_CONFIG.duration);
    };

    const deactivateShield = () => {
        isShieldActive = false;

        if (flickerInterval) {
            clearInterval(flickerInterval);
            flickerInterval = null;
        }

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        if (timerElement) {
            timerElement.remove();
            timerElement = null;
        }

        const visualMesh = rocketship;
        if (visualMesh.material && visualMesh.metadata.originalEmissive) {
            visualMesh.material.emissiveColor = visualMesh.metadata.originalEmissive;
        }
    };

    const showShieldTimer = () => {
        if (timerElement) {
            timerElement.remove();
        }

        timerElement = document.createElement('div');
        timerElement.style.cssText = `
            position: fixed;
            top: ${SHIELD_CONFIG.timer.position.top};
            right: ${SHIELD_CONFIG.timer.position.right};
            font-size: ${SHIELD_CONFIG.timer.fontSize};
            font-weight: bold;
            color: ${SHIELD_CONFIG.timer.color};
            text-shadow: 0 0 10px ${SHIELD_CONFIG.timer.color}, 0 0 20px ${SHIELD_CONFIG.timer.color};
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(timerElement);

        timerInterval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((shieldEndTime - Date.now()) / 1000));
            timerElement.textContent = `Shield ${remaining}s`;

            if (remaining <= 0) {
                clearInterval(timerInterval);
            }
        }, 100);
    };

    const showShieldPopup = (camera) => {
        const popupWorldPos = new BABYLON.Vector3(
            rocketship.position.x,
            rocketship.position.y + 1.2,
            rocketship.position.z
        );

        const engine = scene.getEngine();
        const screenPos = BABYLON.Vector3.Project(
            popupWorldPos,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        const popup = document.createElement('div');
        popup.textContent = SHIELD_CONFIG.popup.text;
        popup.style.cssText = `
            position: fixed;
            left: ${screenPos.x}px;
            top: ${screenPos.y + SHIELD_CONFIG.popup.yOffset}px;
            transform: translate(-50%, -100%);
            font-size: ${SHIELD_CONFIG.popup.fontSize};
            font-weight: bold;
            color: ${SHIELD_CONFIG.popup.color};
            text-shadow: 0 0 10px ${SHIELD_CONFIG.popup.color}, 0 0 20px ${SHIELD_CONFIG.popup.color};
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(popup);

        let yOffset = 0;
        const animationInterval = setInterval(() => {
            yOffset += 2;
            popup.style.top = `${screenPos.y + SHIELD_CONFIG.popup.yOffset - yOffset}px`;
            popup.style.opacity = `${1 - yOffset / 60}`;
        }, 16);

        setTimeout(() => {
            clearInterval(animationInterval);
            popup.remove();
        }, SHIELD_CONFIG.popup.duration);
    };

    // Clean up old observer if it exists
    if (updateObserver) {
        scene.onBeforeRenderObservable.remove(updateObserver);
    }

    updateObserver = scene.onBeforeRenderObservable.add(() => {
        if (powerup) {
            const hitbox = powerup.metadata?.hitbox;
            
            if (hitbox) {
                powerup.position.copyFrom(hitbox.position);
                
                //despawn deathzone
                if (hitbox.position.y < SHIELD_CONFIG.despawnHeight) {
                    // console.log('[SHIELD] Despawning at y:', hitbox.position.y);
                    hitbox.dispose();
                    powerup.dispose();
                    powerup = null;
                    return;
                }
            }
          
            powerup.rotation.z += 0.03;
        }
    });

    return {
        spawnPowerup,
        isShieldActive: () => isShieldActive,
        cleanup: () => {
            if (updateObserver) {
                scene.onBeforeRenderObservable.remove(updateObserver);
                updateObserver = null;
            }
            if (shieldTimeout) clearTimeout(shieldTimeout);
            if (flickerInterval) clearInterval(flickerInterval);
            if (timerInterval) clearInterval(timerInterval);
            if (timerElement) timerElement.remove();
            if (powerup) {
                const hitboxToDispose = powerup.metadata?.hitbox;
                if (hitboxToDispose) hitboxToDispose.dispose();
                powerup.dispose();
                powerup = null;
            }
        }
    };
}
