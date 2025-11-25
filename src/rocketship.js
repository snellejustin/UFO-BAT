import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';
import * as CANNON from 'cannon-es';
import { sensorData } from './witmotion.js';

export const setupArrowKeys = () => {
    const inputMap = {};
    window.addEventListener("keydown", (e) => { inputMap[e.key] = true; });
    window.addEventListener("keyup", (e) => { inputMap[e.key] = false; });
    return inputMap;
};

export const createRocketship = async (scene) => {
    const visualResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/blender-models/",
        "rocket2.glb",
        scene
    );

    const collisionResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/blender-models/",
        "rockethitbox3.glb",
        scene
    );

    const spaceship = visualResult.meshes[0];
    spaceship.name = "spaceship";
    spaceship.position.y = 1.3;

    const collisionMeshes = collisionResult.meshes.filter(m => m.getTotalVertices() > 0);
    const mergedCollision = BABYLON.Mesh.MergeMeshes(
        collisionMeshes,
        true,
        true,
        undefined,
        false,
        false
    );
    
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
            body.linearDamping = 0.05;
            body.angularDamping = 0.05;
            body.linearFactor = new CANNON.Vec3(1, 0, 0);
            body.angularFactor = new CANNON.Vec3(0, 0, 0);
        }

        spaceship.physicsImpostor = mergedCollision.physicsImpostor;
        spaceship.metadata = { 
            baseY: spaceship.position.y,
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

export const setupRocketshipPhysics = (scene, spaceship, inputMap) => {
    let ctrlVX = 0;
    const maxSpeedCtrl = 14.0;
    const accelCtrl = 0.08;
    const decelCtrl = 0.92;
    const steerBlendActive = 0.25;
    const steerBlendIdle = 0.08;

    // SENSOR SETTINGS
    const maxSensorTilt = 30; //30° = Max Speed.
    const deadZone = 2;       //Ignore tiny shakes.

    const canvas = scene.getEngine().getRenderingCanvas();
    const screenWidth = canvas.clientWidth;
    const unitsPerPixel = 0.016;
    const xMax = (screenWidth / 2) * unitsPerPixel;
    const xMin = -xMax;

    const maxTilt = BABYLON.Angle.FromDegrees(90).radians();
    const tiltSmoothness = 0.22;

    const physicsObserver = scene.onBeforeRenderObservable.add(() => {
        const imp = spaceship.physicsImpostor;
        if (!imp) return;

        const collisionMesh = spaceship.metadata.collisionMesh;
        const pos = collisionMesh ? collisionMesh.position : spaceship.position;
        const vel = imp.getLinearVelocity() || BABYLON.Vector3.Zero();

        if (collisionMesh) {
            spaceship.position.copyFrom(collisionMesh.position);
        }

        //inputs
        //keyboard
        const left = inputMap["ArrowLeft"] ? 1 : 0;
        const right = inputMap["ArrowRight"] ? 1 : 0;
        let input = right - left;

        //override with sensor
        if (sensorData.isConnected) {
            let roll = sensorData.roll;
            if (Math.abs(roll) < deadZone) roll = 0;

            //clamping for max speed above 90 degrees (which we will never do lol)
            input = BABYLON.Scalar.Clamp(roll / maxSensorTilt, -1, 1);
        }

        //physics

        if (input !== 0) {
            ctrlVX += input * accelCtrl * maxSpeedCtrl;
        } else {
            ctrlVX *= decelCtrl;
        }
        ctrlVX = BABYLON.Scalar.Clamp(ctrlVX, -maxSpeedCtrl, maxSpeedCtrl);

        const blend = input !== 0 ? steerBlendActive : steerBlendIdle;
        const newVX = BABYLON.Scalar.Lerp(vel.x, ctrlVX, blend);
        imp.setLinearVelocity(new BABYLON.Vector3(newVX, vel.y, 0));

        // Soft bounds on X
        if (pos.x < xMin) {
            spaceship.position.x = xMin;
            if (newVX < 0) imp.setLinearVelocity(new BABYLON.Vector3(0, vel.y, 0));
        } else if (pos.x > xMax) {
            spaceship.position.x = xMax;
            if (newVX > 0) imp.setLinearVelocity(new BABYLON.Vector3(0, vel.y, 0));
        }

        // Pin Y
        const baseY = spaceship.metadata?.baseY ?? 1.3;
        const body = imp.physicsBody;
        body.velocity.y = 0;
        body.position.y = baseY;
        spaceship.position.y = baseY;
    });

    return {
        cleanup: () => scene.onBeforeRenderObservable.remove(physicsObserver),
    };
};
