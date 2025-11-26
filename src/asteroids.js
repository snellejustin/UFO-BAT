import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';

class AsteroidManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.spawnRatePerSecond = options.spawnRatePerSecond ?? 1;
        this.spawnWidth = options.spawnWidth ?? 16;
        this.spawnHeight = options.spawnHeight ?? 13;
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

        this.maxLifetime = 8.0;
        this.flickerDuration = 1.5;

        this.maxPool = options.maxPool ?? 30;

        this.pool = [];
        this.active = [];
        this.spawnAcc = 0;
        this.isActive = false;
        this.asteroidModel = null;
        this.isModelLoaded = false;

        this._loadAsteroidModel();
    }

    async _loadAsteroidModel() {
        try {
            const visualResult = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "asteroidnew5.glb",
                this.scene
            );

            this.asteroidModel = visualResult.meshes[0];
            this.asteroidModel.name = "asteroid_source";
            this.asteroidModel.setEnabled(false);

            visualResult.meshes.forEach(mesh => {
                mesh.setEnabled(false);
            });

            this.isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load asteroid model:", error);
        }
    }

    _rand(min, max) { 
        return min + Math.random() * (max - min); 
    }

    _setAsteroidVisibility(asteroid, visibility) {
        asteroid.visibility = visibility;
        if (asteroid.getChildMeshes) {
            asteroid.getChildMeshes().forEach(m => m.visibility = visibility);
        }
    }

    _createNewAsteroid() {
        const visualMesh = this.asteroidModel.clone('asteroid_visual');
        visualMesh.setEnabled(true);
        visualMesh.rotationQuaternion = null;

        this.asteroidModel.getChildMeshes().forEach(childMesh => {
            const clonedChild = childMesh.clone(childMesh.name + '_clone');
            clonedChild.parent = visualMesh;
            clonedChild.setEnabled(true);
        });

        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "asteroidHitbox",
            { diameter: 1 },
            this.scene
        );
        hitbox.isVisible = false;

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            {
                mass: this.mass,
                restitution: this.restitution,
                friction: this.friction
            },
            this.scene
        );

        const body = hitbox.physicsImpostor.physicsBody;
        body.linearDamping = this.linDamp;
        body.angularDamping = this.angDamp;

        visualMesh.metadata = {
            hitbox: hitbox,
            lifeTime: 0
        };

        return visualMesh;
    }

    _makeOrReuseAsteroid() {
        if (!this.isModelLoaded) return null;

        let asteroid;
        if (this.pool.length > 0) {
            asteroid = this.pool.pop();
            asteroid.setEnabled(true);
        } else if (this.active.length + this.pool.length < this.maxPool) {
            asteroid = this._createNewAsteroid();
        } else {
            return null;
        }

        asteroid.rotationQuaternion = null;

        asteroid.metadata.lifeTime = 0;
        this._setAsteroidVisibility(asteroid, 1.0);

        const size = this._rand(this.sizeMin, this.sizeMax);
        asteroid.scaling.set(size, size, size);
        asteroid.position.set(
            this._rand(-this.spawnWidth * 0.5, this.spawnWidth * 0.5),
            this.spawnHeight,
            0
        );
        asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        const hitbox = asteroid.metadata.hitbox;
        hitbox.setEnabled(true);
        hitbox.position.copyFrom(asteroid.position);

        const baseRadius = 0.5;
        const cannonBody = hitbox.physicsImpostor.physicsBody;
        if (cannonBody && cannonBody.shapes && cannonBody.shapes[0]) {
            cannonBody.shapes[0].radius = baseRadius * size;
            cannonBody.updateBoundingRadius();
        }

        const vx = this._rand(this.driftXMin, this.driftXMax);
        const vy = -this._rand(this.speedMin, this.speedMax);
        const wzx = this._rand(this.spinMin, this.spinMax);
        const wzy = this._rand(this.spinMin, this.spinMax);
        const wzz = this._rand(this.spinMin, this.spinMax);

        asteroid.metadata.spinRates = { x: wzx, y: wzy, z: wzz };

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(vx, vy, 0));
        hitbox.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());

        return asteroid;
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
            const asteroid = this.active[i];
            const hitbox = asteroid.metadata?.hitbox;

            if (hitbox) {
                asteroid.position.copyFrom(hitbox.position);

                const spinRates = asteroid.metadata.spinRates;
                if (spinRates) {
                    asteroid.rotation.x += spinRates.x * dt;
                    asteroid.rotation.y += spinRates.y * dt;
                    asteroid.rotation.z += spinRates.z * dt;
                }

                asteroid.metadata.lifeTime += dt;
                const life = asteroid.metadata.lifeTime;

                if (life > (this.maxLifetime - this.flickerDuration)) {
                    const flickerProgress = (life - (this.maxLifetime - this.flickerDuration)) / this.flickerDuration;
                    const fade = 1.0 - flickerProgress;
                    const pulse = Math.cos(flickerProgress * Math.PI * 10) > 0 ? 1.0 : 0.0;
                    const finalVisibility = fade * pulse;
                    this._setAsteroidVisibility(asteroid, finalVisibility);
                }

                if (life > this.maxLifetime) {
                    hitbox.position.y = this.deathZone - 1;
                }

                if (hitbox.position.y < this.deathZone) {
                    asteroid.setEnabled(false);
                    hitbox.setEnabled(false);

                    hitbox.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    hitbox.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                    hitbox._collisionRegistered = false;

                    this.active.splice(i, 1);
                    this.pool.push(asteroid);
                }
            }
        }
    }

    cleanup() {
        this.active.forEach(asteroid => {
            asteroid.setEnabled(false);
            const hitbox = asteroid.metadata?.hitbox;
            if (hitbox && hitbox.physicsImpostor) {
                hitbox.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                hitbox.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            }
            this.pool.push(asteroid);
        });
        this.active.length = 0;

        this.pool.forEach(asteroid => {
            const hitbox = asteroid.metadata?.hitbox;
            if (hitbox) {
                hitbox.physicsImpostor?.dispose();
                hitbox.dispose();
            }
            asteroid.getChildMeshes().forEach(mesh => mesh.dispose());
            asteroid.dispose();
        });
        this.pool.length = 0;

        if (this.asteroidModel) {
            this.asteroidModel.getChildMeshes().forEach(mesh => mesh.dispose());
            this.asteroidModel.dispose();
        }
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