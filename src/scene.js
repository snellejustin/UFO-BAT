import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import * as CANNON from 'cannon-es';

const createSkybox = (scene) => {
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);

    const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMat", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;

    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
        "textures/space",
        scene,
        ["_px.png", "_py.png", "_pz.png", "_nx.png", "_ny.png", "_nz.png"]
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    skybox.material = skyboxMaterial;

    return skybox;
};

export const createScene = (engine) => {
    const scene = new BABYLON.Scene(engine);
    scene.createDefaultLight();

    const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, -6), scene);
    camera.setTarget(new BABYLON.Vector3(0, 4, 0));
    camera.fov = 1;

    const gravity = new BABYLON.Vector3(0, 0, 0);
    scene.enablePhysics(gravity, new CannonJSPlugin(true, 20, CANNON));
    scene.getPhysicsEngine().setTimeStep(1 / 120);

    const skybox = createSkybox(scene);

    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000; 
        const rotationSpeed = 0.02; 

        skybox.rotation.x += rotationSpeed * dt;
    });

    return scene;
};

export const disableCameraArrowKeys = (scene) => {
    scene.cameras.forEach((cam) => {
        cam.keysUp = [];
        cam.keysDown = [];
        cam.keysLeft = [];
        cam.keysRight = [];
    });
};
