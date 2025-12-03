import { connectToWitMotion } from './witmotion.js';
import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';

export const createHealthBarUI = (scene) => {
    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("HealthUI", true, scene);

    const rudyImage = new GUI.Image("rudyImage", "assets/images/UIexportRudy.png");
    rudyImage.width = "240px";
    rudyImage.height = "180px";
    rudyImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    rudyImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rudyImage.left = "40px";
    rudyImage.top = "-30px";
    guiTexture.addControl(rudyImage);

    const healthBarBgImage = new GUI.Image("healthBarBg", "assets/images/UIexportHealthbar.png");
    healthBarBgImage.width = "250px";
    healthBarBgImage.height = "60px";
    healthBarBgImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBarBgImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    healthBarBgImage.left = "220px";
    healthBarBgImage.top = "-40px";
    guiTexture.addControl(healthBarBgImage);

    const healthBarContainer = new GUI.Rectangle("healthBarContainer");
    healthBarContainer.width = "170px";
    healthBarContainer.height = "20px";
    healthBarContainer.cornerRadius = 4;
    healthBarContainer.color = "transparent";
    healthBarContainer.thickness = 0;
    healthBarContainer.background = "transparent";

    healthBarContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBarContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    healthBarContainer.left = "290px";
    healthBarContainer.top = "-60px";

    guiTexture.addControl(healthBarContainer);

    const healthBarInner = new GUI.Rectangle("healthBarInner");
    healthBarInner.width = "100%";
    healthBarInner.height = "100%";
    healthBarInner.cornerRadius = 2;
    healthBarInner.thickness = 0;
    healthBarInner.background = "#00ff00";
    healthBarInner.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    healthBarContainer.addControl(healthBarInner);

    return {
        guiTexture,
        healthBarInner,
        updateHealthBar: (healthPercent) => {
            const percent = Math.max(0, Math.min(1, healthPercent)) * 100;
            healthBarInner.width = `${percent}%`;

            if (healthPercent > 0.6) healthBarInner.background = "#00ff00";
            else if (healthPercent > 0.3) healthBarInner.background = "#ffff00";
            else healthBarInner.background = "#ff0000";
        },
        dispose: () => {
            if (guiTexture) guiTexture.dispose();
        }
    };
};

export const createLevelProgressBar = (scene, totalLevels = 5) => {
    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("LevelProgressUI", true, scene);

    const progressBarBg = new GUI.Rectangle("progressBarBg");
    progressBarBg.width = "30px";
    progressBarBg.height = "400px";
    progressBarBg.cornerRadius = 15;
    progressBarBg.color = "white";
    progressBarBg.thickness = 3;
    progressBarBg.background = "#202020";
    progressBarBg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    progressBarBg.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    progressBarBg.left = "-30px";
    progressBarBg.top = "0px";
    guiTexture.addControl(progressBarBg);

    const progressFill = new GUI.Rectangle("progressFill");
    progressFill.width = "100%";
    progressFill.height = "0%";
    progressFill.cornerRadius = 15;
    progressFill.thickness = 0;
    progressFill.background = "#00ff00";
    progressFill.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    progressBarBg.addControl(progressFill);

    const checkpoints = [];
    const checkpointSpacing = 400 / (totalLevels + 1);

    for (let i = 0; i < totalLevels; i++) {
        const checkpoint = new GUI.Ellipse(`checkpoint${i}`);
        checkpoint.width = "20px";
        checkpoint.height = "20px";
        checkpoint.color = "white";
        checkpoint.thickness = 3;
        checkpoint.background = "#404040";
        checkpoint.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        checkpoint.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        checkpoint.top = `-${checkpointSpacing * (i + 1) - 10}px`;

        progressBarBg.addControl(checkpoint);
        checkpoints.push(checkpoint);
    }

    return {
        guiTexture,
        progressFill,
        checkpoints,
        updateProgress: (currentLevel) => {
            const progressPercent = (currentLevel / totalLevels) * 100;
            progressFill.height = `${progressPercent}%`;

            checkpoints.forEach((checkpoint, index) => {
                if (index < currentLevel) {
                    checkpoint.background = "#00ff00";
                    checkpoint.color = "#00ff00";
                } else {
                    checkpoint.background = "#404040";
                    checkpoint.color = "white";
                }
            });
        },
        dispose: () => {
            if (guiTexture) guiTexture.dispose();
        }
    };
};

export const createGameOverScreen = (scene, onRestart, onQuit) => {
    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("GameOverUI", true, scene);

    //dark background overlay
    const overlay = new GUI.Rectangle();
    overlay.width = 1;
    overlay.height = 1;
    overlay.background = "black";
    overlay.alpha = 0.8;
    overlay.thickness = 0;
    guiTexture.addControl(overlay);

    //container for the menu items
    const panel = new GUI.StackPanel();
    guiTexture.addControl(panel);

    //game Over Title
    const titleText = new GUI.TextBlock();
    titleText.text = "GAME OVER";
    titleText.color = "#ff0000";
    titleText.fontSize = 80;
    titleText.fontWeight = "bold";
    titleText.height = "150px";
    titleText.shadowColor = "#880000";
    titleText.shadowBlur = 10;
    panel.addControl(titleText);

    //spacer
    const spacer1 = new GUI.Rectangle();
    spacer1.height = "40px";
    spacer1.thickness = 0;
    panel.addControl(spacer1);

    //helper to create styled buttons
    const createButton = (name, text, bgColor) => {
        const button = GUI.Button.CreateSimpleButton(name, text);
        button.width = "250px";
        button.height = "70px";
        button.color = "white";
        button.background = bgColor;
        button.cornerRadius = 10;
        button.fontSize = 30;
        button.fontWeight = "bold";
        button.thickness = 2;

        //hover effects
        button.onPointerEnterObservable.add(() => {
            button.scaleX = 1.1;
            button.scaleY = 1.1;
        });
        button.onPointerOutObservable.add(() => {
            button.scaleX = 1.0;
            button.scaleY = 1.0;
        });

        return button;
    };

    //restart Button
    const restartBtn = createButton("restartBtn", "RESTART", "#008800"); 
    restartBtn.onPointerUpObservable.add(() => {
        cleanup();
        if (onRestart) onRestart();
    });
    panel.addControl(restartBtn);

    //spacer
    const spacer2 = new GUI.Rectangle();
    spacer2.height = "30px";
    spacer2.thickness = 0;
    panel.addControl(spacer2);

    //quit Button
    const quitBtn = createButton("quitBtn", "QUIT", "#cc0000"); 
    quitBtn.onPointerUpObservable.add(() => {
        cleanup();
        if (onQuit) onQuit();
    });
    panel.addControl(quitBtn);

    const cleanup = () => {
        if (guiTexture) guiTexture.dispose();
    };

    return {
        guiTexture,
        dispose: cleanup
    };
};

export const createPlayButton = (scene, countdown, levelManager) => {
    const gameState = {
        isPlaying: false,
    };

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("PlayUI", true, scene);

    const playBtn = GUI.Button.CreateSimpleButton("playBtn", "PLAY");
    playBtn.width = "250px";
    playBtn.height = "80px";
    playBtn.color = "black";
    playBtn.background = "#00ff00"; 
    playBtn.cornerRadius = 10;
    playBtn.fontSize = 35;
    playBtn.fontFamily = "Arial, sans-serif";
    playBtn.fontWeight = "bold";
    playBtn.thickness = 0; 
    playBtn.shadowColor = "#00ff00";
    playBtn.shadowBlur = 0;
    playBtn.shadowOffsetX = 0;
    playBtn.shadowOffsetY = 0;

    //hover effects
    playBtn.onPointerEnterObservable.add(() => {
        playBtn.scaleX = 1.1;
        playBtn.scaleY = 1.1;
        playBtn.shadowBlur = 40; 
    });

    playBtn.onPointerOutObservable.add(() => {
        playBtn.scaleX = 1.0;
        playBtn.scaleY = 1.0;
        playBtn.shadowBlur = 0;
    });

    //click Logic
    playBtn.onPointerUpObservable.add(async () => {
        try {
            await connectToWitMotion();
        } catch (e) {
            console.warn("Witmotion connection cancelled or failed", e);
        }

        guiTexture.dispose();

        //start the game loop
        countdown.startCountdown(() => {
            gameState.isPlaying = true;
            levelManager.startFirstLevel();
        });
    });

    guiTexture.addControl(playBtn);

    return gameState;
};