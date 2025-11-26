import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const HEALTH_BOOST_CONFIG = {
    scale: 0.5,
    spawnHeight: 20,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2,
    hitboxDiameter: 1,
    healAmount: 50,
    maxHealth: 100,
    despawnHeight: -5,

    color: {
        emissive: new BABYLON.Color3(0.3, 0, 0)
    },

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
    }
};

export function createHealthBoost(scene, rocketship, healthManager, camera) {
    let powerup = null;
    let healthBoostModel = null;
    let isModelLoaded = false;

    const loadHealthBoostModel = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "heartpowerup1.glb",
                scene
            );

            healthBoostModel = result.meshes[0];
            healthBoostModel.name = "healthBoost_source";
            healthBoostModel.setEnabled(false);

            result.meshes.forEach(mesh => {
                mesh.setEnabled(false);
            });

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load health boost model:", error);
        }
    };

    loadHealthBoostModel();

    const spawnPowerup = () => {
        console.log('[HEALTH BOOST] spawnPowerup called, isModelLoaded:', isModelLoaded);
        if (!isModelLoaded) return;
        
        if (powerup) {
            powerup.dispose();
        }

        // Clone the health boost model
        const visualMesh = healthBoostModel.clone('healthBoost_visual');
        visualMesh.setEnabled(true);
        visualMesh.scaling.setAll(HEALTH_BOOST_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        console.log('[HEALTH BOOST] Visual mesh created:', visualMesh.name, 'rotation:', visualMesh.rotation);

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

        const spawnX = (Math.random() - 0.5) * HEALTH_BOOST_CONFIG.spawnWidthRange;
        visualMesh.position.set(spawnX, HEALTH_BOOST_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            HEALTH_BOOST_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, HEALTH_BOOST_CONFIG.fallSpeed, 0));

        // Link visual to hitbox
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };
        
        powerup = visualMesh;

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, () => {
            if (powerup) {
                const currentHealth = healthManager.getHealth();
                const newHealth = Math.min(HEALTH_BOOST_CONFIG.maxHealth, currentHealth + HEALTH_BOOST_CONFIG.healAmount);
                healthManager.setHealth(newHealth);

                showHealPopup(newHealth - currentHealth, camera);

                const hitboxToDispose = powerup.metadata?.hitbox;
                if (hitboxToDispose) {
                    hitboxToDispose.dispose();
                }
                powerup.dispose();
                powerup = null;
            }
        });
    };

    const showHealPopup = (amount, camera) => {
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
        popup.textContent = `+${amount}`;
        popup.style.cssText = `
            position: fixed;
            left: ${screenPos.x}px;
            top: ${screenPos.y + HEALTH_BOOST_CONFIG.popup.yOffset}px;
            transform: translate(-50%, -100%);
            font-size: ${HEALTH_BOOST_CONFIG.popup.fontSize};
            font-weight: bold;
            color: ${HEALTH_BOOST_CONFIG.popup.color};
            text-shadow: 0 0 10px ${HEALTH_BOOST_CONFIG.popup.color}, 0 0 20px ${HEALTH_BOOST_CONFIG.popup.color};
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(popup);

        let yOffset = 0;
        const animationInterval = setInterval(() => {
            yOffset += 2;
            popup.style.top = `${screenPos.y + HEALTH_BOOST_CONFIG.popup.yOffset - yOffset}px`;
            popup.style.opacity = `${1 - yOffset / 60}`;
        }, 16);

        setTimeout(() => {
            clearInterval(animationInterval);
            popup.remove();
        }, HEALTH_BOOST_CONFIG.popup.duration);
    };

    scene.registerBeforeRender(() => {
        if (powerup) {
            const hitbox = powerup.metadata?.hitbox;
            
            if (hitbox) {
                // Sync position only
                powerup.position.copyFrom(hitbox.position);
                
                // Despawn if too low
                if (hitbox.position.y < HEALTH_BOOST_CONFIG.despawnHeight) {
                    console.log('[HEALTH BOOST] Despawning at y:', hitbox.position.y);
                    hitbox.dispose();
                    powerup.dispose();
                    powerup = null;
                    return;
                }
            }
            
            powerup.rotation.y += 0.03;
        }
    });

    return {
        spawnPowerup
    };
}
