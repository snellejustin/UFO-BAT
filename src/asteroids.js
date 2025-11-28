import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';

//hitbox asteroid uitzetten na 1 collision met rocketship of andere asteroid
//paralax met meerdere hitboxes of shadertoy
//level progressbar instead of text
//testen of het blijft runnen zonder bugs

const TMP_ZERO = new BABYLON.Vector3(0, 0, 0);
const TMP_VELOCITY = new BABYLON.Vector3(0, 0, 0);

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

        this.sourceAsteroid = null;
        this.sourceHitbox = null;
        this.isReady = false;

        this.loadAsteroidModel();
    }

    async loadAsteroidModel() {
        try {
            const visualResult = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "asteroidnew5.glb",
                this.scene
            );

            const visualMesh = visualResult.meshes.find(m => m.getTotalVertices() > 0);
            if (!visualMesh) return;

            visualMesh.setParent(null);
            visualMesh.name = "asteroid_source";
            visualMesh.setEnabled(false);

            visualResult.meshes.forEach(mesh => {
                if (mesh !== visualMesh) mesh.dispose();
            });

            this.sourceAsteroid = visualMesh;

            this.sourceHitbox = BABYLON.MeshBuilder.CreateSphere("source_hitbox", { diameter: 1 }, this.scene);
            this.sourceHitbox.isVisible = false;
            this.sourceHitbox.setEnabled(false);

            this.isReady = true;

        } catch (error) {
            console.error(error);
        }
    }

    rand(min, max) {
        return min + Math.random() * (max - min);
    }

    createNewAsteroid() {
        const visualMesh = this.sourceAsteroid.clone('asteroid_visual');
        visualMesh.setEnabled(false);

        const hitbox = this.sourceHitbox.clone('asteroidHitbox');
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
        if (body) {
            body.linearDamping = this.linDamp;
            body.angularDamping = this.angDamp;

            body.collisionFilterGroup = 2;

            body.collisionFilterMask = 1 | 8 | 4 | 2;
        }

        visualMesh.metadata = {
            hitbox: hitbox,
            lifeTime: 0,
            spinRates: { x: 0, y: 0, z: 0 }
        };

        return visualMesh;
    }

    makeOrReuseAsteroid() {
        if (!this.isReady) return null;

        let asteroid;
        if (this.pool.length > 0) {
            asteroid = this.pool.pop();
        } else if (this.active.length + this.pool.length < this.maxPool) {
            asteroid = this.createNewAsteroid();
        } else {
            return null;
        }

        const hitbox = asteroid.metadata.hitbox;
        asteroid.setEnabled(true);
        hitbox.setEnabled(true);

        if (hitbox.physicsImpostor) {
            hitbox.physicsImpostor.wakeUp();
            hitbox.physicsImpostor.setLinearVelocity(TMP_ZERO);
            hitbox.physicsImpostor.setAngularVelocity(TMP_ZERO);

            const size = this.rand(this.sizeMin, this.sizeMax);
            hitbox.scaling.setAll(size);
            asteroid.scaling.setAll(size);

            asteroid.position.set(
                this.rand(-this.spawnWidth * 0.5, this.spawnWidth * 0.5),
                this.spawnHeight,
                0
            );
            hitbox.position.copyFrom(asteroid.position);
            hitbox.rotation.setAll(0);

            hitbox.physicsImpostor.forceUpdate();

            const vx = this.rand(this.driftXMin, this.driftXMax);
            const vy = -this.rand(this.speedMin, this.speedMax);

            TMP_VELOCITY.set(vx, vy, 0);
            hitbox.physicsImpostor.setLinearVelocity(TMP_VELOCITY);
            hitbox._collisionRegistered = false;
        }

        asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        asteroid.visibility = 1.0;
        if (asteroid.getChildMeshes) {
            asteroid.getChildMeshes().forEach(m => m.visibility = 1.0);
        }

        const wzx = this.rand(this.spinMin, this.spinMax);
        const wzy = this.rand(this.spinMin, this.spinMax);
        const wzz = this.rand(this.spinMin, this.spinMax);

        asteroid.metadata.spinRates = { x: wzx, y: wzy, z: wzz };
        asteroid.metadata.lifeTime = 0;

        return asteroid;
    }

    recycleAsteroid(asteroid) {
        asteroid.setEnabled(false);
        const hitbox = asteroid.metadata.hitbox;

        if (hitbox) {
            hitbox.setEnabled(false);
            if (hitbox.physicsImpostor) {
                //sleep
                hitbox.physicsImpostor.sleep();
                hitbox.physicsImpostor.setLinearVelocity(TMP_ZERO);
                hitbox.physicsImpostor.setAngularVelocity(TMP_ZERO);

                //to graveyard om botsing te vermijden
                hitbox.position.set(0, -1000, 0);
                hitbox.physicsImpostor.forceUpdate();
            }
        }
        this.pool.push(asteroid);
    }

    update() {
        let dt = this.scene.getEngine().getDeltaTime() / 1000;
        dt = Math.min(dt, 0.1);

        if (this.isActive) {
            this.spawnAcc += this.spawnRatePerSecond * dt;
            while (this.spawnAcc >= 1) {
                const m = this.makeOrReuseAsteroid();
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
                    const pulse = Math.cos(flickerProgress * Math.PI * 10) > 0 ? 1.0 : 0.2;

                    asteroid.visibility = pulse;
                    if (asteroid.getChildMeshes) {
                        asteroid.getChildMeshes().forEach(m => m.visibility = pulse);
                    }
                }

                if (life > this.maxLifetime || hitbox.position.y < this.deathZone) {
                    this.recycleAsteroid(asteroid);
                    this.active.splice(i, 1);
                }
            }
        }
    }

    cleanup() {
        [...this.active, ...this.pool].forEach(asteroid => {
            const hitbox = asteroid.metadata?.hitbox;
            if (hitbox) {
                if (hitbox.physicsImpostor) hitbox.physicsImpostor.dispose();
                hitbox.dispose();
            }
            asteroid.dispose();
        });
        this.active = [];
        this.pool = [];

        if (this.sourceAsteroid) this.sourceAsteroid.dispose();
        if (this.sourceHitbox) this.sourceHitbox.dispose();
        this.isReady = false;
    }
}

export const createAsteroidManager = (scene, options) => {
    const manager = new AsteroidManager(scene, options);
    return {
        manager,
        update: () => manager.update(),
        cleanup: () => manager.cleanup(),
        get active() { return manager.active; }
    };
};