import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';
import * as CANNON from 'cannon-es';
import { sensorData } from './witmotion.js';

export const setupArrowKeys = () => {
    const inputMap = {};

    const onKeyDown = (e) => { inputMap[e.key] = true; };
    const onKeyUp = (e) => { inputMap[e.key] = false; };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
        inputMap,
        dispose: () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        }
    };
};

export const createRocketship = async (scene) => {
    const [visualResult, collisionResult] = await Promise.all([
        BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "rocketreadylights4.glb", scene),
        BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "rockethitbox3.glb", scene)
    ]);

    visualResult.lights.forEach((light) => {
        light.intensity = 4;
    });

    const spaceship = visualResult.meshes[0];
    spaceship.name = "spaceship";
    spaceship.position.y = 1.3;

    const collisionMeshes = collisionResult.meshes.filter(m => m.getTotalVertices() > 0);
    const mergedCollision = BABYLON.Mesh.MergeMeshes(collisionMeshes, true, true, undefined, false, false);

    if (mergedCollision) {
        mergedCollision.name = "spaceshipHitbox";
        mergedCollision.isVisible = false;
        mergedCollision.position.copyFrom(spaceship.position);

        mergedCollision.physicsImpostor = new BABYLON.PhysicsImpostor(
            mergedCollision,
            BABYLON.PhysicsImpostor.MeshImpostor,
            { mass: 2, restitution: 0.25, friction: 0.4 },
            scene
        );

        const body = mergedCollision.physicsImpostor.physicsBody;
        if (body) {
            body.linearDamping = 0.5;
            body.angularDamping = 1.0;
            body.linearFactor = new CANNON.Vec3(1, 0, 0);
            body.angularFactor = new CANNON.Vec3(0, 0, 0);
            body.fixedRotation = true;
            body.updateMassProperties();
        }

        spaceship.physicsImpostor = mergedCollision.physicsImpostor;
        spaceship.metadata = {
            collisionMesh: mergedCollision,
            originalCollisionMesh: mergedCollision
        };

        spaceship.metadata.toggleShield = (active) => {
            const currentVel = spaceship.physicsImpostor.getLinearVelocity();
            
            if (active) {
                //create Shield Sphere
                const shieldMesh = BABYLON.MeshBuilder.CreateSphere("shieldSphere", { diameter: 2 }, scene);
                shieldMesh.scaling.y = 1.5;
                shieldMesh.position.copyFrom(spaceship.metadata.collisionMesh.position);
                shieldMesh.position.y += 1;
                shieldMesh.metadata = { yOffset: 1 };
                
                const material = new BABYLON.StandardMaterial("shieldMat", scene);
                material.diffuseColor = new BABYLON.Color3(0, 0.5, 1);
                material.emissiveColor = new BABYLON.Color3(0, 0.2, 0.8);
                material.alpha = 0.4;
                shieldMesh.material = material;

                //physics
                shieldMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                    shieldMesh,
                    BABYLON.PhysicsImpostor.MeshImpostor,
                    { mass: 2, restitution: 0.25, friction: 0.4 },
                    scene
                );
                
                //apply physics config
                const body = shieldMesh.physicsImpostor.physicsBody;
                if (body) {
                    body.linearDamping = 0.5;
                    body.angularDamping = 1.0;
                    body.linearFactor = new CANNON.Vec3(1, 0, 0);
                    body.angularFactor = new CANNON.Vec3(0, 0, 0);
                    body.fixedRotation = true;
                    body.updateMassProperties();
                }

                //switch
                spaceship.physicsImpostor.dispose(); // Dispose old impostor
                spaceship.physicsImpostor = shieldMesh.physicsImpostor;
                spaceship.metadata.collisionMesh = shieldMesh;
                
                if (currentVel) shieldMesh.physicsImpostor.setLinearVelocity(currentVel);

            } else {
                //revert
                const shieldMesh = spaceship.metadata.collisionMesh;
                const originalMesh = spaceship.metadata.originalCollisionMesh;
                
                //restore original physics
                 originalMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                    originalMesh,
                    BABYLON.PhysicsImpostor.MeshImpostor,
                    { mass: 2, restitution: 0.25, friction: 0.4 },
                    scene
                );
                
                const body = originalMesh.physicsImpostor.physicsBody;
                if (body) {
                    body.linearDamping = 0.5;
                    body.angularDamping = 1.0;
                    body.linearFactor = new CANNON.Vec3(1, 0, 0);
                    body.angularFactor = new CANNON.Vec3(0, 0, 0);
                    body.fixedRotation = true;
                    body.updateMassProperties();
                }

                //switch back
                spaceship.physicsImpostor = originalMesh.physicsImpostor;
                spaceship.metadata.collisionMesh = originalMesh;
                
                //sync position just in case
                originalMesh.position.copyFrom(shieldMesh.position);
                if (shieldMesh.metadata && shieldMesh.metadata.yOffset) {
                    originalMesh.position.y -= shieldMesh.metadata.yOffset;
                }
                
                if (currentVel) originalMesh.physicsImpostor.setLinearVelocity(currentVel);

                //cleanup shield
                shieldMesh.dispose();
            }
        };
    }

    const particleSystem = new BABYLON.ParticleSystem("thruster", 400, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

    particleSystem.emitter = spaceship;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, 0, 0);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0, 0);
    particleSystem.color1 = new BABYLON.Color4(1, 0.4, 0.4, 1);
    particleSystem.color2 = new BABYLON.Color4(0.7, 0.2, 0, 1);
    particleSystem.colorDead = new BABYLON.Color4(0.7, 0.7, 0, 0);
    particleSystem.minSize = 0.4;
    particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.4;
    particleSystem.emitRate = 150;
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, -3, 0);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, -3, 0);
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 2;
    particleSystem.start();

    spaceship.metadata.particleSystem = particleSystem;

    return spaceship;
};

export const setupRocketshipPhysics = (scene, spaceship, inputWrapper) => {
    const maxSpeed = 25.0;
    const accelRate = 0.50;
    const brakeRate = 0.20;

    const maxSensorTilt = 15;
    const deadZone = 0.4;

    const shipHalfWidth = 1.0;

    let xMax = 0;
    let xMin = 0;

    const calculateScreenBoundary = () => {
        const engine = scene.getEngine();
        const camera = scene.activeCamera;

        const ray = scene.createPickingRay(
            engine.getRenderWidth(),
            engine.getRenderHeight() / 2,
            BABYLON.Matrix.Identity(),
            camera
        );

        const distanceToPlane = (0 - ray.origin.z) / ray.direction.z;
        const hitPoint = ray.origin.add(ray.direction.scale(distanceToPlane));

        xMax = Math.abs(hitPoint.x) - shipHalfWidth;
        xMin = -xMax;
    };

    calculateScreenBoundary();
    const resizeObserver = scene.getEngine().onResizeObservable.add(() => {
        calculateScreenBoundary();
    });

    const tmpVelocity = new BABYLON.Vector3();
    const newVelocityVector = new BABYLON.Vector3();

    const physicsObserver = scene.onBeforeRenderObservable.add(() => {
        const imp = spaceship.physicsImpostor;
        if (!imp) return;

        const collisionMesh = spaceship.metadata.collisionMesh;
        const pos = collisionMesh ? collisionMesh.position : spaceship.position;

        const currentVel = imp.getLinearVelocity();
        if (currentVel) {
            tmpVelocity.copyFrom(currentVel);
        } else {
            tmpVelocity.setAll(0);
        }

        if (collisionMesh) {
            spaceship.position.copyFrom(collisionMesh.position);
            if (collisionMesh.metadata && collisionMesh.metadata.yOffset) {
                spaceship.position.y -= collisionMesh.metadata.yOffset;
            }
        }

        const left = inputWrapper.inputMap["ArrowLeft"] ? 1 : 0;
        const right = inputWrapper.inputMap["ArrowRight"] ? 1 : 0;
        let input = right - left;

        if (sensorData.isConnected) {
            let roll = sensorData.roll;
            if (Math.abs(roll) < deadZone) roll = 0;
            input = BABYLON.Scalar.Clamp(roll / maxSensorTilt, -1, 1);
        }

        const targetVX = input * maxSpeed;
        const lerpFactor = (Math.abs(input) > 0.01) ? accelRate : brakeRate;

        let finalVX = BABYLON.Scalar.Lerp(tmpVelocity.x, targetVX, lerpFactor);

        if (Math.abs(input) < 0.01 && Math.abs(finalVX) < 0.1) {
            finalVX = 0;
        }

        if (pos.x > xMax) {
            spaceship.position.x = xMax;
            if (collisionMesh) collisionMesh.position.x = xMax;
            if (finalVX > 0) finalVX = 0;
        }
        else if (pos.x < xMin) {
            spaceship.position.x = xMin;
            if (collisionMesh) collisionMesh.position.x = xMin;
            if (finalVX < 0) finalVX = 0;
        }

        newVelocityVector.set(finalVX, 0, 0);
        imp.setLinearVelocity(newVelocityVector);
    });

    return {
        cleanup: () => {
            scene.onBeforeRenderObservable.remove(physicsObserver);
            scene.getEngine().onResizeObservable.remove(resizeObserver);
        },
    };
};