import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import { sensorData } from './witmotion';
import * as CANNON from 'cannon-es';

const createSkyboxLayer = (scene, name, size, opacity, texturePath) => {
    const skybox = BABYLON.MeshBuilder.CreateBox(name, { size: size }, scene);

    const skyboxMaterial = new BABYLON.StandardMaterial(name + "Mat", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.alpha = opacity;

    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
        texturePath,
        scene,
        ["px.png", "py.png", "pz.png", "nx.png", "ny.png", "nz.png"]
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    // skyboxMaterial.reflectionTexture.level = 2.3; //voor glow
    skybox.material = skyboxMaterial;

    return skybox;
};

export const createScene = (engine) => {
    const scene = new BABYLON.Scene(engine);

    scene.createDefaultLight();
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, -6), scene);
    camera.setTarget(new BABYLON.Vector3(0, 4, 0));
    camera.fov = 1;

    const gravity = new BABYLON.Vector3(0, 0, 0);
    scene.enablePhysics(gravity, new CannonJSPlugin(true, 20, CANNON));

    //glow layer
    const gl = new BABYLON.GlowLayer("glow", scene);
    gl.intensity = 0.6;

    const skyboxOuter = createSkyboxLayer(scene, "skyBoxOuter",2000, 1.0, "textures/");
    const skyboxInner = createSkyboxLayer(scene, "skyBoxInner", 1000, 0.4, "textures/");

    //offset
    skyboxInner.rotation.x = Math.PI / 4;

    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;
        const rotationSpeed = 0.02;

        if (skyboxOuter) {
            skyboxOuter.rotation.x += rotationSpeed * dt;
        }
        if (skyboxInner) {
            skyboxInner.rotation.x += (rotationSpeed * 1.7) * dt;
        }
      
        if (sensorData.isConnected) {
            const targetRoll = -BABYLON.Tools.ToRadians(sensorData.roll);

            if (skyboxOuter) {
                skyboxOuter.rotation.y = BABYLON.Scalar.Lerp(skyboxOuter.rotation.y, targetRoll, 0.005);
            }
            if (skyboxInner) {
                skyboxInner.rotation.y = BABYLON.Scalar.Lerp(skyboxInner.rotation.y, targetRoll, 0.005);
            }
        }
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