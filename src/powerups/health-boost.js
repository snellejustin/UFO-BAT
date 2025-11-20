import * as BABYLON from '@babylonjs/core';

const HEALTH_BOOST_CONFIG = {
    meshSize: 0.8,
    spawnHeight: 20,
    spawnWidthRange: 10,
    fallSpeed: -4,
    healAmount: 50,
    maxHealth: 100,
    despawnHeight: -5,

    color: {
        diffuse: new BABYLON.Color3(1, 0, 0),
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

    const spawnPowerup = () => {
        if (powerup) {
            powerup.dispose();
        }

        powerup = BABYLON.MeshBuilder.CreateSphere('healthBoost', { diameter: HEALTH_BOOST_CONFIG.meshSize }, scene);

        const material = new BABYLON.StandardMaterial('healthBoostMat', scene);
        material.diffuseColor = HEALTH_BOOST_CONFIG.color.diffuse;
        material.emissiveColor = HEALTH_BOOST_CONFIG.color.emissive;
        powerup.material = material;

        const spawnX = (Math.random() - 0.5) * HEALTH_BOOST_CONFIG.spawnWidthRange;
        powerup.position.set(spawnX, HEALTH_BOOST_CONFIG.spawnHeight, 0);

        powerup.physicsImpostor = new BABYLON.PhysicsImpostor(
            powerup,
            BABYLON.PhysicsImpostor.SphereImpostor,
            HEALTH_BOOST_CONFIG.physics,
            scene
        );

        powerup.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, HEALTH_BOOST_CONFIG.fallSpeed, 0));

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        collisionMesh.physicsImpostor.registerOnPhysicsCollide(powerup.physicsImpostor, () => {
            if (powerup) {
                const currentHealth = healthManager.getHealth();
                const newHealth = Math.min(HEALTH_BOOST_CONFIG.maxHealth, currentHealth + HEALTH_BOOST_CONFIG.healAmount);
                healthManager.setHealth(newHealth);

                showHealPopup(newHealth - currentHealth, camera);

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
        if (powerup && powerup.position.y < HEALTH_BOOST_CONFIG.despawnHeight) {
            powerup.dispose();
            powerup = null;
        }
    });

    return {
        spawnPowerup
    };
}
