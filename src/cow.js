import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export const createCowManager = (scene) => {
    let cowModel = null;
    let isLoaded = false;

    const loadCow = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "cow.glb", 
                scene
            );
            cowModel = result.meshes[0];
            cowModel.name = "cow_source";
            cowModel.setEnabled(false);
            isLoaded = true;
            console.log("Cow model loaded successfully from blender-models");
        } catch (e) {
            console.error("Failed to load cow model:", e);
        }
    };

    loadCow();

    const spawnCow = (direction = 'left-to-right') => {
        if (!isLoaded || !cowModel) return;

        const cow = cowModel.instantiateHierarchy();
        cow.name = "floating_cow";
        cow.setEnabled(true);
        
        //random initial rotation
        cow.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        //random rotation speed
        const rotationSpeed = new BABYLON.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        );

        const startX = direction === 'left-to-right' ? -35 : 35;
        const endX = direction === 'left-to-right' ? 35 : -35;
        const yPos = (Math.random() * 10) + 18; //height 18 to 28
        const zPos = 18;

        cow.position = new BABYLON.Vector3(startX, yPos, zPos);
        cow.scaling = new BABYLON.Vector3(1, 1, 1); //default scale, adjust if needed

        const speed = 0.12;

        //animation loop
        const observer = scene.onBeforeRenderObservable.add(() => {
            if (!cow || cow.isDisposed()) {
                scene.onBeforeRenderObservable.remove(observer);
                return;
            }
            //move
            cow.position.x += (direction === 'left-to-right' ? speed : -speed);

            //rotate
            cow.rotation.addInPlace(rotationSpeed);

            //check bounds to dispose
            if ((direction === 'left-to-right' && cow.position.x > 35) ||
                (direction === 'right-to-left' && cow.position.x < -35)) {
                console.log("Cow reached end of path, disposing");
                cow.dispose();
                scene.onBeforeRenderObservable.remove(observer);
            }
        });
    };

    return {
        spawnCow
    };
};
