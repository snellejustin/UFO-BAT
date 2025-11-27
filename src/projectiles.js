import * as BABYLON from '@babylonjs/core';

export const createProjectileManager = (scene) => {
    const projectiles = [];
    let currentConfig = {
        size: 0.2,
        color: { r: 0.063, g: 0.992, b: 0.847 },
        glowIntensity: 1.0
    };

    const setProjectileConfig = (config) => {
        if (config) {
            currentConfig = {
                size: config.size ?? 0.2,
                color: config.color ?? { r: 0.063, g: 0.992, b: 0.847 },
                glowIntensity: config.glowIntensity ?? 1.0
            };
        }
    };

    const shootProjectile = (position, speed = -5, velocityDirection = null) => {
        const projectile = BABYLON.MeshBuilder.CreateSphere('projectile', { diameter: currentConfig.size }, scene);
        projectile.position.copyFrom(position);

        const material = new BABYLON.StandardMaterial('projectileMat', scene);
        const color = new BABYLON.Color3(currentConfig.color.r, currentConfig.color.g, currentConfig.color.b);
        material.emissiveColor = color.scale(currentConfig.glowIntensity);
        material.diffuseColor = color;
        projectile.material = material;

        projectile.physicsImpostor = new BABYLON.PhysicsImpostor(
            projectile,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 0.5, restitution: 0.3, friction: 0.1 },
            scene
        );

        if (velocityDirection) {
            projectile.physicsImpostor.setLinearVelocity(velocityDirection);
        } else {
            projectile.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, speed, 0));
        }

        projectiles.push({
            mesh: projectile,
            active: true
        });
    };

    const update = () => {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            
            if (!proj.active) continue;

            if (proj.mesh.position.y < -2) {
                if (proj.mesh.physicsImpostor) {
                    proj.mesh.physicsImpostor.dispose();
                }
                proj.mesh.dispose();
                projectiles.splice(i, 1);
            }
        }
    };

    const cleanup = () => {
        projectiles.forEach(proj => {
            if (proj.mesh) {
                if (proj.mesh.physicsImpostor) {
                    proj.mesh.physicsImpostor.dispose();
                }
                proj.mesh.dispose();
            }
        });
        projectiles.length = 0;
    };

    const getActiveProjectiles = () => {
        return projectiles.filter(p => p.active).map(p => p.mesh);
    };

    const removeProjectile = (projectileMesh) => {
        const index = projectiles.findIndex(p => p.mesh === projectileMesh);
        if (index !== -1) {
            const proj = projectiles[index];
            if (proj.mesh.physicsImpostor) {
                proj.mesh.physicsImpostor.dispose();
            }
            proj.mesh.dispose();
            projectiles.splice(index, 1);
        }
    };

    return {
        shootProjectile,
        setProjectileConfig,
        update,
        cleanup,
        getActiveProjectiles,
        removeProjectile,
        projectiles
    };
};
