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
        BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "rocket2.glb", scene),
        BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "rockethitbox3.glb", scene)
    ]);

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
            //locking X-as
            body.linearFactor = new CANNON.Vec3(1, 0, 0);
            //locking rotation
            body.angularFactor = new CANNON.Vec3(0, 0, 0);
            //rotation vastzetten zodat rocket ni omver kletst
            body.fixedRotation = true;
            body.updateMassProperties();
        }

        spaceship.physicsImpostor = mergedCollision.physicsImpostor;
        spaceship.metadata = {
            collisionMesh: mergedCollision
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
    let ctrlVX = 0;

    const maxSpeedCtrl = 14.0;
    const accelCtrl = 0.18;
    const decelCtrl = 0.92;
    const steerBlendActive = 0.25;
    const steerBlendIdle = 0.08;
    const maxSensorTilt = 30;
    const deadZone = 0.5;

    const canvas = scene.getEngine().getRenderingCanvas();
    const screenWidth = canvas.clientWidth;
    const unitsPerPixel = 0.016;
    const xMax = (screenWidth / 2) * unitsPerPixel;
    const xMin = -xMax;

    const _tmpVelocity = new BABYLON.Vector3();
    const _newVelocityVector = new BABYLON.Vector3();

    const physicsObserver = scene.onBeforeRenderObservable.add(() => {
        const imp = spaceship.physicsImpostor;
        if (!imp) return;

        const collisionMesh = spaceship.metadata.collisionMesh;
        const pos = collisionMesh ? collisionMesh.position : spaceship.position;

        const currentVel = imp.getLinearVelocity();
        if (currentVel) {
            _tmpVelocity.copyFrom(currentVel);
        } else {
            _tmpVelocity.setAll(0);
        }

        if (collisionMesh) {
            spaceship.position.copyFrom(collisionMesh.position);
        }

        const left = inputWrapper.inputMap["ArrowLeft"] ? 1 : 0;
        const right = inputWrapper.inputMap["ArrowRight"] ? 1 : 0;
        let input = right - left;
        //sensor override keyboard
        if (sensorData.isConnected) {
            let roll = sensorData.roll;
            if (Math.abs(roll) < deadZone) roll = 0;
            input = BABYLON.Scalar.Clamp(roll / maxSensorTilt, -1, 1);
        }
        
        //velocity etc
        if (input !== 0) {
            ctrlVX += input * accelCtrl * maxSpeedCtrl;
        } else {
            ctrlVX *= decelCtrl;
        }
        ctrlVX = BABYLON.Scalar.Clamp(ctrlVX, -maxSpeedCtrl, maxSpeedCtrl);

        const blend = input !== 0 ? steerBlendActive : steerBlendIdle;
        const newVX = BABYLON.Scalar.Lerp(_tmpVelocity.x, ctrlVX, blend);

        //bounds
        let finalVX = newVX;

        if (pos.x < xMin) {
            spaceship.position.x = xMin;
            collisionMesh.position.x = xMin;
            if (finalVX < 0) finalVX = 0; //stop naar links gaan
        } else if (pos.x > xMax) {
            spaceship.position.x = xMax;
            collisionMesh.position.x = xMax;
            if (finalVX > 0) finalVX = 0; //stop naar rechts gaan
        }

        _newVelocityVector.set(finalVX, 0, 0);
        imp.setLinearVelocity(_newVelocityVector);
    });

    return {
        cleanup: () => {
            scene.onBeforeRenderObservable.remove(physicsObserver);
        },
    };
};