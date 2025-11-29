import * as BABYLON from '@babylonjs/core';

const COL_GROUP_PROJECTILE = 8;
const COL_MASK_ACTIVE = 1 | 2;  //hits player and asteroids
const COL_MASK_INACTIVE = 0;    //ghost mode

export const createProjectileManager = (scene) => {
    //pool voor bullets te recyclen
    const poolSize = 50;
    const pool = [];
    let sharedMaterial = null;

    let currentConfig = {
        size: 0.2,
        color: { r: 0.063, g: 0.992, b: 0.847 },
        glowIntensity: 1.0
    };

    const updateSharedMaterial = () => {
        if (!sharedMaterial) {
            sharedMaterial = new BABYLON.StandardMaterial('projectileMat', scene);
        }

        const color = new BABYLON.Color3(currentConfig.color.r, currentConfig.color.g, currentConfig.color.b);
        sharedMaterial.emissiveColor = color.scale(currentConfig.glowIntensity);
        sharedMaterial.diffuseColor = color;
        sharedMaterial.disableLighting = true;
    };
    updateSharedMaterial();

    const setProjectileConfig = (config) => {
        if (config) {
            currentConfig = {
                size: config.size ?? 0.2,
                color: config.color ?? { r: 0.063, g: 0.992, b: 0.847 },
                glowIntensity: config.glowIntensity ?? 1.0
            };
            updateSharedMaterial();
        }
    };

    //niewe bullets in case nodig
    const createNewProjectile = () => {
        const mesh = BABYLON.MeshBuilder.CreateSphere('projectile', { diameter: 1 }, scene);
        mesh.scaling.setAll(currentConfig.size);
        mesh.material = sharedMaterial;
        mesh.isVisible = false;
        mesh.setEnabled(false);

        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            mesh,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 0.5, restitution: 0.3, friction: 0.1 },
            scene
        );

        const body = mesh.physicsImpostor.physicsBody;
        if (body) {
            body.collisionFilterGroup = COL_GROUP_PROJECTILE;
            body.collisionFilterMask = COL_MASK_INACTIVE;
        }

        mesh.physicsImpostor.sleep();

        mesh.position.set(0, -1000, 0);
        mesh.physicsImpostor.forceUpdate();

        return { mesh, active: false };
    };

    //meteen pool vol doen
    for (let i = 0; i < poolSize; i++) {
        pool.push(createNewProjectile());
    }

    const shootProjectile = (position, speed = -5, velocityDirection = null) => {
        //inacteive bullet zoeken
        let projectileData = pool.find(p => !p.active);

        //hier dus de nieuwe bullet maken indien nodig met vorige functie
        if (!projectileData) {
            projectileData = createNewProjectile();
            pool.push(projectileData);
        }

        const { mesh } = projectileData;

        //terug activeren
        projectileData.active = true;
        mesh.isVisible = true;
        mesh.setEnabled(true);

        mesh.position.copyFrom(position);
        mesh.rotation.setAll(0);

        mesh.scaling.setAll(currentConfig.size);

        //reset anders mogelijks momentum etc behouden
        if (mesh.physicsImpostor) {
            mesh.physicsImpostor.forceUpdate();

            mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());

            //nieuwe velocity
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
            if (proj.mesh.position.y < -2) {
                recycleProjectile(proj);
            }
        }
    };

    const recycleProjectile = (proj) => {
        proj.active = false;
        proj.mesh.isVisible = false;
        proj.mesh.setEnabled(false);

        //physics berekening ff stoppen
        if (proj.mesh.physicsImpostor) {
            proj.mesh.physicsImpostor.sleep();
        }
    };

    const removeProjectile = (projectileMesh) => {
        const proj = pool.find(p => p.mesh === projectileMesh);
        if (proj) {
            recycleProjectile(proj);
        }
    };

    const getActiveProjectiles = () => {
        return pool.filter(p => p.active).map(p => p.mesh);
    };

    const cleanup = () => {
        pool.forEach(proj => {
            if (proj.mesh) {
                if (proj.mesh.physicsImpostor) {
                    proj.mesh.physicsImpostor.dispose();
                }
                proj.mesh.dispose();
            }
        });
        pool.length = 0;
        if (sharedMaterial) {
            sharedMaterial.dispose();
        }
    };

    return {
        shootProjectile,
        setProjectileConfig,
        update,
        cleanup,
        getActiveProjectiles,
        removeProjectile,
        projectiles: pool
    };
};