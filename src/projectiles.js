import * as BABYLON from '@babylonjs/core';

//maskers voor collision filters (Cannon.js)
const MASK_INACTIVE = 0;      // Botst met niets
const MASK_ACTIVE = -1;       // Botst met alles (default)

export const createProjectileManager = (scene) => {
    const poolSize = 80;
    const pool = [];

    //queue om kogels veilig te verwijderen NA de physics stap
    const removalQueue = [];

    let ufoMaterial = null;
    let currentConfig = { size: 0.2, color: { r: 0.063, g: 0.992, b: 0.847 }, glowIntensity: 1.0 };

    const rocketMaterial = new BABYLON.StandardMaterial('rocketProjectileMat', scene);
    rocketMaterial.emissiveColor = new BABYLON.Color3(1, 0, 0);
    rocketMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
    rocketMaterial.disableLighting = true;

    const updateUfoMaterial = () => {
        if (!ufoMaterial) {
            ufoMaterial = new BABYLON.StandardMaterial('ufoProjectileMat', scene);
        }
        const color = new BABYLON.Color3(currentConfig.color.r, currentConfig.color.g, currentConfig.color.b);
        ufoMaterial.emissiveColor = color.scale(currentConfig.glowIntensity);
        ufoMaterial.diffuseColor = color;
        ufoMaterial.disableLighting = true;
    };
    updateUfoMaterial();

    const setProjectileConfig = (config) => {
        if (config) {
            currentConfig = {
                size: config.size ?? 0.2,
                color: config.color ?? { r: 0.063, g: 0.992, b: 0.847 },
                glowIntensity: config.glowIntensity ?? 1.0
            };
            updateUfoMaterial();
        }
    };

    //pool
    const createNewProjectile = () => {
        const mesh = BABYLON.MeshBuilder.CreateSphere('projectile', { diameter: 1 }, scene);
        mesh.isVisible = false;
        mesh.setEnabled(false);

        //vlag om dubbele hits te voorkomen
        mesh.isHit = false;

        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            mesh,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 0.5, restitution: 0.3, friction: 0.1 },
            scene
        );

        //zet standaard uit
        if (mesh.physicsImpostor.physicsBody) {
            mesh.physicsImpostor.physicsBody.collisionFilterMask = MASK_INACTIVE;
        }

        mesh.physicsImpostor.sleep();
        mesh.position.set(0, -1000, 0);

        return { mesh, active: false };
    };

    for (let i = 0; i < poolSize; i++) {
        pool.push(createNewProjectile());
    }

    //recycle logic
    const recycleProjectile = (proj) => {
        if (!proj.active) return;

        proj.active = false;
        proj.mesh.isVisible = false;
        proj.mesh.setEnabled(false);

        //reset flags
        proj._bossCollisionRegistered = false;
        proj.mesh.isHit = false;

        if (proj.mesh.physicsImpostor) {
            proj.mesh.physicsImpostor.sleep();

            //zet physics masker op "niets raken"
            const body = proj.mesh.physicsImpostor.physicsBody;
            if (body) {
                body.collisionFilterMask = MASK_INACTIVE;
                body.velocity.set(0, 0, 0);
                body.angularVelocity.set(0, 0, 0);
            }

            proj.mesh.position.set(0, -1000, 0);
            proj.mesh.physicsImpostor.forceUpdate();
        }
    };

    //zet de physics MASK direct op 0 zodat er GEEN tweede botsing kan plaatsvinden in dezelfde frame.
    const disableAndRemove = (mesh) => {
        if (mesh.isHit) return;

        mesh.isHit = true;
        mesh.isVisible = false;

        //fysieke lock: stop direct met botsen in Cannon.js
        if (mesh.physicsImpostor && mesh.physicsImpostor.physicsBody) {
            mesh.physicsImpostor.physicsBody.collisionFilterMask = MASK_INACTIVE;
        }

        //plan de daadwerkelijke reset voor na de physics stap
        if (!removalQueue.includes(mesh)) {
            removalQueue.push(mesh);
        }
    };

    //observer die draait NA de physics step
    const physicsObserver = scene.onAfterPhysicsObservable.add(() => {
        if (removalQueue.length > 0) {
            removalQueue.forEach(mesh => {
                const proj = pool.find(p => p.mesh === mesh);
                if (proj) {
                    recycleProjectile(proj);
                }
            });
            removalQueue.length = 0;
        }
    });

    const shootProjectile = (position, speed = -5, velocityDirection = null, isPlayerShot = false) => {
        let projectileData = pool.find(p => !p.active);

        if (!projectileData) {
            projectileData = createNewProjectile();
            pool.push(projectileData);
        }

        const { mesh } = projectileData;
        projectileData.active = true;
        mesh.isVisible = true;
        mesh.setEnabled(true);
        mesh.isHit = false; //reset lock

        mesh.position.copyFrom(position);

        if (isPlayerShot) {
            mesh.position.y += 2.2;
            mesh.material = rocketMaterial;
            mesh.scaling.setAll(0.3);
        } else {
            mesh.material = ufoMaterial;
            mesh.scaling.setAll(currentConfig.size);
        }

        mesh.rotation.setAll(0);

        if (mesh.physicsImpostor) {
            mesh.physicsImpostor.wakeUp();
            mesh.physicsImpostor.forceUpdate();
            mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());

            const body = mesh.physicsImpostor.physicsBody;
            if (body) {
                //zet physics weer AAN (bots met alles)
                body.collisionFilterGroup = 1;
                body.collisionFilterMask = MASK_ACTIVE;
            }

            if (velocityDirection) {
                mesh.physicsImpostor.setLinearVelocity(velocityDirection);
            } else {
                mesh.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, speed, 0));
            }
        }
    };

    const update = () => {
        for (let i = 0; i < pool.length; i++) {
            const proj = pool[i];
            if (!proj.active) continue;

            //recycle off screen
            if (proj.mesh.position.y < -5 || proj.mesh.position.y > 25) {
                disableAndRemove(proj.mesh);
            }
        }
    };

    const cleanup = () => {
        scene.onAfterPhysicsObservable.remove(physicsObserver);

        pool.forEach(proj => {
            if (proj.mesh) {
                if (proj.mesh.physicsImpostor) proj.mesh.physicsImpostor.dispose();
                proj.mesh.dispose();
            }
        });
        pool.length = 0;
        if (ufoMaterial) ufoMaterial.dispose();
        if (rocketMaterial) rocketMaterial.dispose();
    };

    return {
        shootProjectile,
        setProjectileConfig,
        update,
        cleanup,
        getActiveProjectiles: () => pool.filter(p => p.active).map(p => p.mesh),
        removeProjectile: disableAndRemove,
        projectiles: pool
    };
};