import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent'; // ensure v1 APIs

/**
 * Manages asteroid spawning, movement (via physics v1), and cleanup
 */
class AsteroidManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        // ---- Tunables
        this.spawnRatePerSecond = options.spawnRatePerSecond ?? 1;
        this.spawnWidth = options.spawnWidth ?? 16;
        this.spawnHeight = options.spawnHeight ?? 10;
        this.deathZone = options.deathZone ?? -5;

        this.speedMin = options.speedMin ?? 0.2;   // downward speed (u/s)
        this.speedMax = options.speedMax ?? 1;
        this.driftXMin = options.driftXMin ?? -0.6; // lateral speed (u/s)
        this.driftXMax = options.driftXMax ?? 0.6;

        this.sizeMin = options.sizeMin ?? 0.5;
        this.sizeMax = options.sizeMax ?? 2.4;
        this.spinMin = options.spinMin ?? -1.2;   // rad/s
        this.spinMax = options.spinMax ?? 1.2;

        // Physics properties
        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.7;
        this.friction = options.friction ?? 0.2;
        this.linDamp = options.linearDamping ?? 0.02;
        this.angDamp = options.angularDamping ?? 0.05;

        this.maxPool = options.maxPool ?? 300;

        // Shared material
        this.material = new BABYLON.StandardMaterial('asteroidMat', this.scene);
        this.material.diffuseColor = new BABYLON.Color3(0.65, 0.65, 0.65);
        this.material.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        // Source mesh (we CLONE for physics; instances won't work with impostors)
        this.source = BABYLON.MeshBuilder.CreateIcoSphere('asteroid_src', {
            radius: 0.3,
            subdivisions: 2
        }, this.scene);
        this.source.isVisible = false;
        this.source.material = this.material;

        this.pool = [];   // { mesh }
        this.active = []; // { mesh }
        this.spawnAcc = 0;
        this.isActive = false; // Game state flag
    }

    _rand(min, max) { return min + Math.random() * (max - min); }

    _makeOrReuseAsteroid() {
        let mesh;
        if (this.pool.length > 0) {
            mesh = this.pool.pop();
            mesh.setEnabled(true);
        } else if (this.active.length + this.pool.length < this.maxPool) {
            mesh = this.source.clone('asteroid');
            mesh.isVisible = true;
            mesh.material = this.material;

           
            mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                mesh,
                BABYLON.PhysicsImpostor.SphereImpostor,
                { mass: this.mass, restitution: this.restitution, friction: this.friction },
                this.scene
            );

            const body = mesh.physicsImpostor.physicsBody; // Cannon.Body
            body.linearDamping = this.linDamp;
            body.angularDamping = this.angDamp;

        } else {
            return null;
        }

        // Randomize transform
        const size = this._rand(this.sizeMin, this.sizeMax);
        mesh.scaling.set(size, size, size);
        mesh.position.set(
            this._rand(-this.spawnWidth * 0.5, this.spawnWidth * 0.5),
            this.spawnHeight,
            0
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        // Reset velocities (important when reusing)
        const vx = this._rand(this.driftXMin, this.driftXMax);
        const vy = -this._rand(this.speedMin, this.speedMax);
        const wzx = this._rand(this.spinMin, this.spinMax);
        const wzy = this._rand(this.spinMin, this.spinMax);
        const wzz = this._rand(this.spinMin, this.spinMax);

        mesh.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(vx, vy, 0));
        mesh.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(wzx, wzy, wzz));

        return mesh;
    }

    update() {
        const dt = this.scene.getEngine().getDeltaTime() / 1000;

        // Only spawn asteroids if the game is active
        if (this.isActive) {
            // spawn with accumulator (frame-rate independent)
            this.spawnAcc += this.spawnRatePerSecond * dt;
            while (this.spawnAcc >= 1) {
                const m = this._makeOrReuseAsteroid();
                if (m) this.active.push(m);
                this.spawnAcc -= 1;
            }
        }

        // cull below death zone
        for (let i = this.active.length - 1; i >= 0; i--) {
            const m = this.active[i];
            if (m.position.y < this.deathZone) {
                // Disable and zero velocities, then pool
                m.setEnabled(false);
                if (m.physicsImpostor) {
                    m.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                this.active.splice(i, 1);
                this.pool.push(m);
            }
        }
    }

    cleanup() {
        // push actives to pool (disabled)
        this.active.forEach(m => {
            m.setEnabled(false);
            if (m.physicsImpostor) {
                m.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            }
            this.pool.push(m);
        });
        this.active.length = 0;

        // dispose pooled meshes + impostors
        this.pool.forEach(m => {
            m.physicsImpostor?.dispose();
            m.dispose();
        });
        this.pool.length = 0;

        this.source?.dispose();
        this.material?.dispose();
    }
}

/**
 * Factory function (same API)
 */
export const createAsteroidManager = (scene, options) => {
    const manager = new AsteroidManager(scene, options);
    return {
        manager,
        update: () => manager.update(),
        cleanup: () => manager.cleanup(),
    };
};
