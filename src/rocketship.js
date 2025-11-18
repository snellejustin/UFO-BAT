import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import '@babylonjs/loaders/glTF';
import * as CANNON from 'cannon-es';

export const setupArrowKeys = () => {
    const inputMap = {};
    window.addEventListener("keydown", (e) => { inputMap[e.key] = true; });
    window.addEventListener("keyup", (e) => { inputMap[e.key] = false; });
    return inputMap;
};

export const createRocketship = async (scene) => {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/blender-models/",
        "rocketready.glb",
        scene
    );

    const spaceship = result.meshes[0];
    spaceship.name = "spaceship";
    spaceship.position.y = 1.3;

    const boundingInfo = spaceship.getHierarchyBoundingVectors();
    const size = boundingInfo.max.subtract(boundingInfo.min);
    const radius = Math.max(size.x, size.y, size.z) / 2;

    spaceship.physicsImpostor = new BABYLON.PhysicsImpostor(
        spaceship,
        BABYLON.PhysicsImpostor.SphereImpostor,
        { mass: 2, restitution: 0.25, friction: 0.4 },
        scene
    );

    const body = spaceship.physicsImpostor.physicsBody;
    body.linearDamping = 0.05;
    body.angularDamping = 0.05;
    body.linearFactor = new CANNON.Vec3(1, 0, 0);
    body.angularFactor = new CANNON.Vec3(0, 0, 0);

    spaceship.metadata = { baseY: spaceship.position.y };

    return spaceship;
};


export const setupRocketshipPhysics = (scene, spaceship, inputMap) => {
    let ctrlVX = 0;                 // target sideways speed from input (units/sec)
    const maxSpeedCtrl = 14.0;       // how fast the ship can go sideways
    const accelCtrl = 0.08;      // how quickly target speed ramps up (per frame)
    const decelCtrl = 0.92;      // how target speed eases when no input (0..1)
    const steerBlendActive = 0.25;  // blend toward ctrlVX while steering (snappier)
    const steerBlendIdle = 0.08;  // blend while coasting (gentler → lets bumps show)

    // Calculate bounds based on screen width (device-aware)
    const canvas = scene.getEngine().getRenderingCanvas();
    
    // Use screen width to determine world space bounds
    // Approximate: 1 unit in world space per 50 pixels
    const screenWidth = canvas.clientWidth;
    const unitsPerPixel = 0.016; // 1 unit = 50 pixels
    const xMax = (screenWidth / 2) * unitsPerPixel;
    const xMin = -xMax;

    const maxTilt = BABYLON.Angle.FromDegrees(90).radians();
    const tiltSmoothness = 0.22;

    const physicsObserver = scene.onBeforeRenderObservable.add(() => {
        const imp = spaceship.physicsImpostor;
        if (!imp) return;

        const pos = spaceship.getAbsolutePosition();
        const vel = imp.getLinearVelocity() || BABYLON.Vector3.Zero();

        // Input: -1, 0, +1
        const left = inputMap["ArrowLeft"] ? 1 : 0;
        const right = inputMap["ArrowRight"] ? 1 : 0;
        const input = right - left;

        //Build target control speed (smooth accel/decel)
        if (input !== 0) {
            ctrlVX += input * accelCtrl * maxSpeedCtrl;
        } else {
            ctrlVX *= decelCtrl; // glide down smoothly when keys released
        }
        ctrlVX = BABYLON.Scalar.Clamp(ctrlVX, -maxSpeedCtrl, maxSpeedCtrl);

        // Blend actual physics velocity toward the control target
        // When steering: snappier blend; when idle: gentle blend so asteroid hits are still felt.
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
        const body = imp.physicsBody; // Cannon.Body
        body.velocity.y = 0;
        body.position.y = baseY;
        spaceship.position.y = baseY;

        //Slight tilt based on real velocity
        const tiltTarget = -(newVX / maxSpeedCtrl) * (maxTilt * 3);
        spaceship.rotation.z = BABYLON.Scalar.Lerp(spaceship.rotation.z, tiltTarget, tiltSmoothness);
    });

    return {
        cleanup: () => scene.onBeforeRenderObservable.remove(physicsObserver),
    };
};
