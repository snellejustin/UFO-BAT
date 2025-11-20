import * as BABYLON from '@babylonjs/core';

export const createProjectileManager = (scene) => {
    const projectiles = [];

    const shootProjectile = (position) => {
        const projectile = BABYLON.MeshBuilder.CreateSphere('projectile', { diameter: 0.2 }, scene);
        projectile.position.copyFrom(position);

        const material = new BABYLON.StandardMaterial('projectileMat', scene);
        material.emissiveColor = new BABYLON.Color3(0, 0, 1);
        material.diffuseColor = new BABYLON.Color3(0, 0, 1);
        projectile.material = material;

        projectile.physicsImpostor = new BABYLON.PhysicsImpostor(
            projectile,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 0.5, restitution: 0.3, friction: 0.1 },
            scene
        );

        projectile.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, -5, 0));

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
        update,
        cleanup,
        getActiveProjectiles,
        removeProjectile,
        projectiles
    };
};
