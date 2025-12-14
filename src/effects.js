import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export const createFadeTransition = (scene, onMidPoint, onComplete) => {
    let transitionTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("TransitionUI", true, scene);
    const blackScreen = new GUI.Rectangle();
    blackScreen.width = "100%";
    blackScreen.height = "100%";
    blackScreen.background = "black";
    blackScreen.thickness = 0;
    blackScreen.alpha = 0;
    transitionTexture.addControl(blackScreen);

    const frameRate = 60;
    const fadeAnim = new BABYLON.Animation("fade", "alpha", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    fadeAnim.setKeys([
        { frame: 0, value: 0 },
        { frame: 45, value: 1 } // 0.75s fade to black
    ]);

    scene.beginDirectAnimation(blackScreen, [fadeAnim], 0, 45, false, 1, () => {
        if (onMidPoint) onMidPoint();

        // Re-create texture to ensure it is on top of any new UI created in onMidPoint
        transitionTexture.dispose();
        transitionTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("TransitionUI", true, scene);
        
        const blackScreen2 = new GUI.Rectangle();
        blackScreen2.width = "100%";
        blackScreen2.height = "100%";
        blackScreen2.background = "black";
        blackScreen2.thickness = 0;
        blackScreen2.alpha = 1;
        transitionTexture.addControl(blackScreen2);

        const fadeOutAnim = new BABYLON.Animation("fadeOut", "alpha", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        fadeOutAnim.setKeys([
            { frame: 0, value: 1 },
            { frame: 60, value: 0 } // 1s fade out
        ]);

        scene.beginDirectAnimation(blackScreen2, [fadeOutAnim], 0, 60, false, 1, () => {
            transitionTexture.dispose();
            if (onComplete) onComplete();
        });
    });
};
