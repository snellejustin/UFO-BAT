import * as BABYLON from '@babylonjs/core';

export const createRocketShooter = (scene, rocketship, camera) => {
    let activePowerup = null;
    let isActive = false;
    let onCollectedCallback = null;
    let updateObserver = null; // Track observer for cleanup

    const spawnPowerup = (onCollected) => {
        if (activePowerup) return;

        onCollectedCallback = onCollected;

        const powerup = BABYLON.MeshBuilder.CreateSphere('rocketShooterPowerup', { diameter: 0.5 }, scene);
        powerup.position.set(0, 15, 0);

        const material = new BABYLON.StandardMaterial('rocketShooterMat', scene);
        material.emissiveColor = new BABYLON.Color3(1, 0, 0);
        material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        powerup.material = material;

        powerup.physicsImpostor = new BABYLON.PhysicsImpostor(
            powerup,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 1, restitution: 0.3 },
            scene
        );

        powerup.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, -4, 0));

        activePowerup = powerup;

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
        
        collisionMesh.physicsImpostor.registerOnPhysicsCollide(powerup.physicsImpostor, () => {
            if (activePowerup) {
                collectPowerup();
            }
        });

        // Clean up old observer if exists
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
        }

        updateObserver = scene.onBeforeRenderObservable.add(() => {
            if (!activePowerup) return;

            if (activePowerup.position.y <= 2 && activePowerup.physicsImpostor) {
                activePowerup.position.y = 2;
                activePowerup.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                activePowerup.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            }
        });
    };

    const collectPowerup = () => {
        if (!activePowerup) return;

        if (activePowerup.physicsImpostor) {
            activePowerup.physicsImpostor.dispose();
        }
        activePowerup.dispose();
        activePowerup = null;

        isActive = true;

        showCollectionPopup();
        
        if (onCollectedCallback) {
            onCollectedCallback(true);
            onCollectedCallback = null;
        }
    };

    const showCollectionPopup = () => {
        const rocketWorldPos = new BABYLON.Vector3(
            rocketship.position.x,
            rocketship.position.y + 2,
            rocketship.position.z
        );

        const engine = scene.getEngine();
        const screenPos = BABYLON.Vector3.Project(
            rocketWorldPos,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        const popup = document.createElement('div');
        popup.textContent = 'ROCKET SHOOTER!';
        popup.style.cssText = `
            position: fixed;
            left: ${screenPos.x}px;
            top: ${screenPos.y - 30}px;
            transform: translate(-50%, -100%);
            font-size: 24px;
            font-weight: bold;
            color: #FF0000;
            text-shadow: 0 0 10px #FF0000, 0 0 20px #FF0000;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(popup);

        let yOffset = 0;
        const animationInterval = setInterval(() => {
            yOffset += 2;
            popup.style.top = `${screenPos.y - 30 - yOffset}px`;
            popup.style.opacity = `${1 - yOffset / 60}`;
        }, 16);

        setTimeout(() => {
            clearInterval(animationInterval);
            popup.remove();
        }, 1000);
    };

    const isPowerupActive = () => isActive;

    const isPowerupCollected = () => {
        return activePowerup === null && isActive;
    };

    const cleanup = () => {
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
            updateObserver = null;
        }
        if (activePowerup) {
            if (activePowerup.physicsImpostor) {
                activePowerup.physicsImpostor.dispose();
            }
            activePowerup.dispose();
            activePowerup = null;
        }
        isActive = false;
    };

    return {
        spawnPowerup,
        isPowerupActive,
        isPowerupCollected,
        cleanup
    };
};
