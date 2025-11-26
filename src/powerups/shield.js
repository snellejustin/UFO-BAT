import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const SHIELD_CONFIG = {
    scale: 0.5, // Scale down the model
    spawnHeight: 20,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2, // Radians per second
    hitboxDiameter: 1, // Sphere hitbox size
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

    // Load shield model
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

    const spawnPowerup = () => {
        console.log('[SHIELD] spawnPowerup called, isModelLoaded:', isModelLoaded);
        if (!isModelLoaded) return;
        
        if (powerup) {
            powerup.dispose();
        }

        // Clone the shield model
        const visualMesh = shieldModel.clone('shield_visual');
        visualMesh.setEnabled(true);
        visualMesh.scaling.setAll(SHIELD_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        console.log('[SHIELD] Visual mesh created:', visualMesh.name, 'rotation:', visualMesh.rotation);

        shieldModel.getChildMeshes().forEach(childMesh => {
            const clonedChild = childMesh.clone(childMesh.name + '_clone');
            clonedChild.parent = visualMesh;
            clonedChild.setEnabled(true);
        });

        // Create separate invisible hitbox sphere for physics (like asteroids)
        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "shieldHitbox",
            { diameter: SHIELD_CONFIG.hitboxDiameter },
            scene
        );
        hitbox.isVisible = false;

        const spawnX = (Math.random() - 0.5) * SHIELD_CONFIG.spawnWidthRange;
        visualMesh.position.set(spawnX, SHIELD_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            SHIELD_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, SHIELD_CONFIG.fallSpeed, 0));

        // Link visual to hitbox
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

    scene.registerBeforeRender(() => {
        if (powerup) {
            const hitbox = powerup.metadata?.hitbox;
            
            if (hitbox) {
                // Sync position only
                powerup.position.copyFrom(hitbox.position);
                
                // Despawn if too low
                if (hitbox.position.y < SHIELD_CONFIG.despawnHeight) {
                    console.log('[SHIELD] Despawning at y:', hitbox.position.y);
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
        isShieldActive: () => isShieldActive
    };
}
