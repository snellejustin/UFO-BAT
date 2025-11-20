import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';

class AsteroidManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.spawnRatePerSecond = options.spawnRatePerSecond ?? 1;
        this.spawnWidth = options.spawnWidth ?? 16;
        this.spawnHeight = options.spawnHeight ?? 25;
        this.deathZone = options.deathZone ?? -5;

        this.speedMin = options.speedMin ?? null;
        this.speedMax = options.speedMax ?? null;
        this.driftXMin = options.driftXMin ?? -0.6;
        this.driftXMax = options.driftXMax ?? 0.6;

        this.sizeMin = options.sizeMin ?? 0.5;
        this.sizeMax = options.sizeMax ?? 2.4;
        this.spinMin = options.spinMin ?? -1.2;
        this.spinMax = options.spinMax ?? 1.2;

        this.mass = options.mass ?? 1;
        this.restitution = options.restitution ?? 0.7;
        this.friction = options.friction ?? 0.2;
        this.linDamp = options.linearDamping ?? 0.02;
        this.angDamp = options.angularDamping ?? 0.05;

        this.maxPool = options.maxPool ?? 300;

        this.material = new BABYLON.StandardMaterial('asteroidMat', this.scene);
        this.material.diffuseColor = new BABYLON.Color3(0.65, 0.65, 0.65);
        this.material.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        this.source = BABYLON.MeshBuilder.CreateIcoSphere('asteroid_src', {
            radius: 0.3,
            subdivisions: 2
        }, this.scene);
        this.source.isVisible = false;
        this.source.material = this.material;

        this.pool = [];
        this.active = [];
        this.spawnAcc = 0;
        this.isActive = false;
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

            const body = mesh.physicsImpostor.physicsBody;
            body.linearDamping = this.linDamp;
            body.angularDamping = this.angDamp;

        } else {
            return null;
        }

        const size = this._rand(this.sizeMin, this.sizeMax);
        mesh.scaling.set(size, size, size);
        mesh.position.set(
            this._rand(-this.spawnWidth * 0.5, this.spawnWidth * 0.5),
            this.spawnHeight,
            0
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

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
        let dt = this.scene.getEngine().getDeltaTime() / 1000;
        
        dt = Math.min(dt, 0.1);

        if (this.isActive) {
            this.spawnAcc += this.spawnRatePerSecond * dt;
            while (this.spawnAcc >= 1) {
                const m = this._makeOrReuseAsteroid();
                if (m) this.active.push(m);
                this.spawnAcc -= 1;
            }
        }

        for (let i = this.active.length - 1; i >= 0; i--) {
            const m = this.active[i];
            if (m.position.y < this.deathZone) {
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
        this.active.forEach(m => {
            m.setEnabled(false);
            if (m.physicsImpostor) {
                m.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                m.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            }
            this.pool.push(m);
        });
        this.active.length = 0;

        this.pool.forEach(m => {
            m.physicsImpostor?.dispose();
            m.dispose();
        });
        this.pool.length = 0;

        this.source?.dispose();
        this.material?.dispose();
    }
}

export const createAsteroidManager = (scene, options) => {
    const manager = new AsteroidManager(scene, options);
    return {
        manager,
        update: () => manager.update(),
        cleanup: () => manager.cleanup(),
    };
};
