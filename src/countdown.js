import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

export const createCountdown = (scene) => {
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("CountdownUI", true, scene);

    const countText = new GUI.TextBlock();
    countText.text = "";
    countText.color = "#00ff00";
    countText.fontSize = 120;
    countText.fontFamily = "GameFont, Arial, sans-serif";
    countText.fontWeight = "bold";
    countText.shadowColor = "#00ff00";
    countText.shadowBlur = 40;
    countText.isVisible = false;
    advancedTexture.addControl(countText);

    const animatePop = () => {
        const frameRate = 60;
        const scaleAnim = new BABYLON.Animation(
            "countPop",
            "scaleX",
            frameRate,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [
            { frame: 0, value: 0.5 },
            { frame: 10, value: 1.2 }, //kleine overshoot
            { frame: 20, value: 1.0 } 
        ];

        scaleAnim.setKeys(keys);

        scene.beginDirectAnimation(countText, [scaleAnim], 0, 20, false);

        // const fontSizeAnim = new BABYLON.Animation("fontPop", "fontSize", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        // fontSizeAnim.setKeys([{ frame: 0, value: 60 }, { frame: 10, value: 140 }, { frame: 20, value: 120 }]);
        // scene.beginDirectAnimation(countText, [fontSizeAnim], 0, 20, false);
    };

    const result = {
        onCountdownStart: null
    };

    const startCountdown = (onComplete) => {
        if (result.onCountdownStart) {
            result.onCountdownStart();
        }

        let count = 3;
        countText.text = count.toString();
        countText.isVisible = true;

        //soundeffect komt hier nog
        animatePop();

        const timerId = setInterval(() => {
            count--;

            if (count > 0) {
                countText.text = count.toString();
                animatePop();
            } else {
                clearInterval(timerId);
                countText.isVisible = false; //hide UI

                if (onComplete) {
                    onComplete();
                }
            }
        }, 1000);
    };

    result.startCountdown = startCountdown;
    result.dispose = () => {
        if (advancedTexture) {
            advancedTexture.dispose();
        }
    };

    return result;
};