import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';

const TMP_ZERO = new BABYLON.Vector3(0, 0, 0);
const TMP_VELOCITY = new BABYLON.Vector3(0, 0, 0);

const DEFAULT_ASTEROID_CONFIG = {
    spawnRatePerSecond: 1,
    spawnWidth: 16,
    spawnHeight: 15,
    deathZone: -5,
    speedMin: 2,
    speedMax: 4,
    driftXMin: -0.6,
    driftXMax: 0.6,
    sizeMin: 0.5,
    sizeMax: 2.4,
    spinMin: -1.2,
    spinMax: 1.2,
    mass: 1,
    restitution: 0.7,
    friction: 0.2,
    linearDamping: 0.02,
    angularDamping: 0.05,
    maxPool: 30,
    maxLifetime: 8.0,
    flickerDuration: 1.5
};

class AsteroidManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        //options overschrijven de defaults
        const config = { ...DEFAULT_ASTEROID_CONFIG, ...options };

        this.spawnRatePerSecond = config.spawnRatePerSecond;
        this.spawnWidth = config.spawnWidth;
        this.spawnHeight = config.spawnHeight;
        this.deathZone = config.deathZone;

        this.speedMin = config.speedMin;
        this.speedMax = config.speedMax;
        this.driftXMin = config.driftXMin;
        this.driftXMax = config.driftXMax;

        this.sizeMin = config.sizeMin;
        this.sizeMax = config.sizeMax;
        this.spinMin = config.spinMin;
        this.spinMax = config.spinMax;

        this.mass = config.mass;
        this.restitution = config.restitution;
        this.friction = config.friction;

        this.linDamp = config.linearDamping;
        this.angDamp = config.angularDamping;

        this.maxLifetime = config.maxLifetime;
        this.flickerDuration = config.flickerDuration;
        this.maxPool = config.maxPool;

        this.pool = [];
        this.active = [];
        this.spawnAcc = 0;
        this.isActive = false;

        this.sourceAsteroid = null;
        this.sourceHitbox = null;
        this.isReady = false;
        this.collisionSound = null;
        this.allHitboxes = [];

        this.loadAsteroidModel();
    }

    async loadAsteroidModel() {
        try {
            // Load collision sound
            this.collisionSound = await BABYLON.CreateSoundAsync("asteroidImpact", "assets/sounds/ast-ast.mp3", {
                volume: 0.4,
                maxInstances: 5
            });

            const visualResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "asteroidnew5.glb", this.scene);
            //zoek de eerste mesh die vertices heeft (zodat je geen lege root node pakt)
            const visualMesh = visualResult.meshes.find(m => m.getTotalVertices() > 0);
            if (!visualMesh) return;

            visualMesh.setParent(null);
            visualMesh.name = "asteroid_source";

            //voor handmatige rotatie mogelijk te maken
            visualMesh.rotationQuaternion = null;

            visualMesh.setEnabled(false);

            //overige nodes opruimen
            visualResult.meshes.forEach(mesh => { if (mesh !== visualMesh) mesh.dispose(); });

            this.sourceAsteroid = visualMesh;

            this.sourceHitbox = BABYLON.MeshBuilder.CreateSphere("source_hitbox", { diameter: 1 }, this.scene);
            this.sourceHitbox.isVisible = false;
            this.sourceHitbox.setEnabled(false);

            this.isReady = true;

        } catch (error) { console.error(error); }
    }

    rand(min, max) { return min + Math.random() * (max - min); }

    createNewAsteroid() {
        const visualMesh = this.sourceAsteroid.clone('asteroid_visual');
        visualMesh.setEnabled(false);
        visualMesh.rotationQuaternion = null;

        const hitbox = this.sourceHitbox.clone('asteroidHitbox');
        hitbox.isVisible = false;

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox, BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: this.mass, restitution: this.restitution, friction: this.friction },
            this.scene
        );

        const body = hitbox.physicsImpostor.physicsBody;
        if (body) {
            body.linearDamping = this.linDamp;
            body.angularDamping = this.angDamp;
        }

        // Register collision with other asteroids
        if (this.collisionSound) {
            this.allHitboxes.forEach(otherHitbox => {
                if (otherHitbox.physicsImpostor) {
                    hitbox.physicsImpostor.registerOnPhysicsCollide(otherHitbox.physicsImpostor, () => {
                        // Only play sound if both asteroids are active/visible
                        if (hitbox.isEnabled() && otherHitbox.isEnabled()) {
                            this.collisionSound.play();
                        }
                    });
                }
            });
            this.allHitboxes.push(hitbox);
        }

        visualMesh.metadata = { hitbox: hitbox, lifeTime: 0, spinRates: { x: 0, y: 0, z: 0 } };
        return visualMesh;
    }

    makeOrReuseAsteroid() {
        if (!this.isReady) return null;

        let asteroid;
        if (this.pool.length > 0) {
            asteroid = this.pool.pop();
            asteroid.setEnabled(true);
        } else if (this.active.length + this.pool.length < this.maxPool) {
            asteroid = this.createNewAsteroid();
        } else {
            return null;
        }

        const hitbox = asteroid.metadata.hitbox;

        //activeer mesh en hitbox
        asteroid.setEnabled(true);
        hitbox.setEnabled(true);

        if (hitbox.physicsImpostor) {
            //reset physics state
            hitbox.physicsImpostor.wakeUp();

            //al gebeurd bij sleep maar nog is voor zekerheid
            hitbox.physicsImpostor.setLinearVelocity(TMP_ZERO);
            hitbox.physicsImpostor.setAngularVelocity(TMP_ZERO);

            //positie en grootte bepalen
            const size = this.rand(this.sizeMin, this.sizeMax);
            hitbox.scaling.setAll(size);
            asteroid.scaling.setAll(size);

            asteroid.position.set(
                this.rand(-this.spawnWidth * 0.5, this.spawnWidth * 0.5),
                this.spawnHeight,
                0
            );
            hitbox.position.copyFrom(asteroid.position);
            hitbox.rotation.setAll(0); // Reset rotatie van de bol

            //forceer update zodat de physics engine de nieuwe positie direct kent
            hitbox.physicsImpostor.forceUpdate();

            //snelheid geven
            const vx = this.rand(this.driftXMin, this.driftXMax);
            const vy = -this.rand(this.speedMin, this.speedMax);
            TMP_VELOCITY.set(vx, vy, 0);
            hitbox.physicsImpostor.setLinearVelocity(TMP_VELOCITY);

            //reset interne Babylon collision flag
            hitbox.collisionRegistered = false;
        }

        asteroid.rotationQuaternion = null;

        //zichtbaarheid resetten voor geval hij uitfade in recycle
        asteroid.visibility = 1.0;
        if (asteroid.getChildMeshes) { asteroid.getChildMeshes().forEach(m => m.visibility = 1.0); }

        asteroid.metadata.spinRates = {
            x: this.rand(this.spinMin, this.spinMax),
            y: this.rand(this.spinMin, this.spinMax),
            z: this.rand(this.spinMin, this.spinMax)
        };
        asteroid.metadata.lifeTime = 0;

        return asteroid;
    }

    recycleAsteroid(asteroid) {
        asteroid.setEnabled(false);
        const hitbox = asteroid.metadata.hitbox;

        if (hitbox) {
            hitbox.setEnabled(false);
            if (hitbox.physicsImpostor) {
                //zet physics stil zodat geen rekenkracht kost
                hitbox.physicsImpostor.sleep();
                hitbox.physicsImpostor.setLinearVelocity(TMP_ZERO);
                hitbox.physicsImpostor.setAngularVelocity(TMP_ZERO);
                
                //move far away to prevent ghost collisions
                hitbox.position.set(0, -1000, 0);
                hitbox.physicsImpostor.forceUpdate();
            }
        }
        this.pool.push(asteroid);
    }

    update() {
        let dt = this.scene.getEngine().getDeltaTime() / 1000;

        if (this.isActive) {
            this.spawnAcc += this.spawnRatePerSecond * dt;

            if (this.spawnAcc >= 1) {
                const newAsteroid = this.makeOrReuseAsteroid();
                if (newAsteroid) this.active.push(newAsteroid);

                this.spawnAcc -= 1;
            }
        }

        //loop achterstevoren om veilig te kunnen splicen
        for (let i = this.active.length - 1; i >= 0; i--) {
            const asteroid = this.active[i];
            const hitbox = asteroid.metadata?.hitbox;

            if (hitbox) {
                //synchroniseer visual mesh met physics mesh
                asteroid.position.copyFrom(hitbox.position);

                const spin = asteroid.metadata.spinRates;
                if (spin) {
                    asteroid.rotation.x += spin.x * dt;
                    asteroid.rotation.y += spin.y * dt;
                    asteroid.rotation.z += spin.z * dt;
                }

                asteroid.metadata.lifeTime += dt;
                const life = asteroid.metadata.lifeTime;

                //flickering effect voor despawn
                if (life > (this.maxLifetime - this.flickerDuration)) {
                    const flickerProgress = (life - (this.maxLifetime - this.flickerDuration)) / this.flickerDuration;
                    const pulse = Math.cos(flickerProgress * Math.PI * 10) > 0 ? 1.0 : 0.2;
                    asteroid.visibility = pulse;
                    if (asteroid.getChildMeshes) { asteroid.getChildMeshes().forEach(m => m.visibility = pulse); }
                }

                //despawn conditie
                if (life > this.maxLifetime || hitbox.position.y < this.deathZone) {
                    this.recycleAsteroid(asteroid);
                    this.active.splice(i, 1);
                }
            }
        }
    }

    reset() {
        while (this.active.length > 0) {
            const asteroid = this.active.pop();
            this.recycleAsteroid(asteroid);
        }
        this.spawnAcc = 0;
        this.isActive = false;
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
        this.allHitboxes = [];
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
        reset: () => manager.reset(),
        cleanup: () => manager.cleanup(),
        get active() { return manager.active; }
    };
};