import { connectToWitMotion, onWitmotionDisconnect, sensorData } from './witmotion.js';
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

    const mainWrapper = new GUI.Container("mainWrapper");
    mainWrapper.width = "100px";
    mainWrapper.height = "70%";
    mainWrapper.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    mainWrapper.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    mainWrapper.left = "-20px";
    mainWrapper.clipChildren = false;
    guiTexture.addControl(mainWrapper);

    const cowImage = new GUI.Image("cowImage", "assets/images/progressbar/cow.png");
    cowImage.width = "80px";
    cowImage.height = "80px";
    cowImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    cowImage.zIndex = 10;
    mainWrapper.addControl(cowImage);

    const progressBarContainer = new GUI.Container("progressBarContainer");
    progressBarContainer.widthInPixels = 50;
    progressBarContainer.height = "92%";
    progressBarContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    mainWrapper.addControl(progressBarContainer);

    const progressBarBg = new GUI.Image("progressBarBg", "assets/images/progressbar/bar.png");
    progressBarBg.width = "100%";
    progressBarBg.height = "100%";
    progressBarContainer.addControl(progressBarBg);

    const progressFill = new GUI.Rectangle("progressFill");
    progressFill.width = "35%";
    progressFill.height = "0%";
    progressFill.cornerRadius = 4;
    progressFill.thickness = 0;
    progressFill.background = "#d8ac44ff";
    progressFill.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    progressBarContainer.addControl(progressFill);

    const checkpoints = [];
    const checkpointSpacing = 100 / totalLevels; 

    for (let i = 0; i < totalLevels; i++) {
        const levelNumber = i + 1;
        
        const checkpoint = new GUI.Image(
            `checkpoint${i}`, 
            `assets/images/progressbar/numbers/inactive/inactive-${levelNumber}.png`
        );
        checkpoint.width = "50px";
        checkpoint.height = "50px";
        checkpoint.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        checkpoint.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        //position based on start of level (0%, 20%, 40%...)
        checkpoint.top = `-${checkpointSpacing * i}%`;

        progressBarContainer.addControl(checkpoint);
        checkpoints.push({
            image: checkpoint,
            levelNumber: levelNumber,
            //activate when progress reaches this point (start of level)
            threshold: checkpointSpacing * i
        });
    }

    let currentAnimationObserver = null;

    const updateCheckpoints = (currentPercent) => {
        checkpoints.forEach((checkpoint) => {
            if (currentPercent >= checkpoint.threshold) {
                checkpoint.image.source = `assets/images/progressbar/numbers/active/active-${checkpoint.levelNumber}.png`;
            } else {
                checkpoint.image.source = `assets/images/progressbar/numbers/inactive/inactive-${checkpoint.levelNumber}.png`;
            }
        });
    };

    return {
        guiTexture,
        progressFill,
        checkpoints,
        updateProgress: (currentLevel) => {
            const progressPercent = (currentLevel / totalLevels) * 100;
            progressFill.height = `${progressPercent}%`;
            updateCheckpoints(progressPercent);
        },
        animateTo: (targetPercent, duration) => {
            if (currentAnimationObserver) {
                scene.onBeforeRenderObservable.remove(currentAnimationObserver);
                currentAnimationObserver = null;
            }

            const startHeight = parseFloat(progressFill.height) || 0;
            const startTime = performance.now();
            
            currentAnimationObserver = scene.onBeforeRenderObservable.add(() => {
                const now = performance.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const currentPercent = startHeight + (targetPercent - startHeight) * progress;
                progressFill.height = `${currentPercent}%`;
                
                updateCheckpoints(currentPercent);

                if (progress >= 1) {
                    scene.onBeforeRenderObservable.remove(currentAnimationObserver);
                    currentAnimationObserver = null;
                }
            });
        },
        reset: () => {
            if (currentAnimationObserver) {
                scene.onBeforeRenderObservable.remove(currentAnimationObserver);
                currentAnimationObserver = null;
            }
            progressFill.height = "0%";
            updateCheckpoints(0);
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

    //game Over Title
    const titleText = new GUI.TextBlock();
    titleText.text = "GAME OVER";
    titleText.color = "#ff0000";
    titleText.fontSize = 80;
    titleText.fontFamily = "GameFont, Arial, sans-serif";
    titleText.fontWeight = "bold";
    titleText.top = "-250px";
    titleText.shadowColor = "#880000";
    titleText.shadowBlur = 10;
    guiTexture.addControl(titleText);

    // Lean Bar Container
    const barContainer = new GUI.Rectangle();
    barContainer.width = "400px";
    barContainer.height = "40px";
    barContainer.background = "#333333";
    barContainer.thickness = 2;
    barContainer.color = "white";
    barContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    barContainer.top = "-50px";
    guiTexture.addControl(barContainer);

    // Center Line
    const centerLine = new GUI.Rectangle();
    centerLine.width = "2px";
    centerLine.height = "100%";
    centerLine.background = "white";
    centerLine.thickness = 0;
    barContainer.addControl(centerLine);

    // Lean Indicator
    const indicator = new GUI.Rectangle();
    indicator.width = "20px";
    indicator.height = "100%";
    indicator.background = "#00BFFF";
    indicator.thickness = 0;
    indicator.cornerRadius = 10;
    barContainer.addControl(indicator);

    // Labels for the bar
    const leftLabel = new GUI.TextBlock();
    leftLabel.text = "RESTART";
    leftLabel.color = "#00ff00";
    leftLabel.fontSize = 20;
    leftLabel.fontFamily = "GameFont, Arial, sans-serif";
    leftLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftLabel.left = "10px";
    barContainer.addControl(leftLabel);

    const rightLabel = new GUI.TextBlock();
    rightLabel.text = "STOP";
    rightLabel.color = "#ff0000";
    rightLabel.fontSize = 20;
    rightLabel.fontFamily = "GameFont, Arial, sans-serif";
    rightLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightLabel.left = "-10px";
    barContainer.addControl(rightLabel);

    // 3D UI Setup
    const UI_LAYER_MASK = 0x20000000;
    const uiCamera = new BABYLON.FreeCamera("GameOverCamera", new BABYLON.Vector3(0, 0, -10), scene);
    uiCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    uiCamera.setTarget(BABYLON.Vector3.Zero());
    uiCamera.layerMask = UI_LAYER_MASK;
    
    // Orthographic bounds
    const width = scene.getEngine().getRenderWidth();
    const height = scene.getEngine().getRenderHeight();
    const ratio = width / height;
    const zoom = 4;
    uiCamera.orthoTop = zoom;
    uiCamera.orthoBottom = -zoom;
    uiCamera.orthoLeft = -zoom * ratio;
    uiCamera.orthoRight = zoom * ratio;

    // Light for the models
    const light = new BABYLON.HemisphericLight("GameOverLight", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1.5;
    light.includeOnlyWithLayerMask = UI_LAYER_MASK;

    // Manage active cameras
    if (!scene.activeCameras || scene.activeCameras.length === 0) {
        scene.activeCameras = [scene.activeCamera];
    }
    scene.activeCameras.push(uiCamera);

    let restartMesh = null;
    let stopMesh = null;
    let isDisposed = false;

    // Load Models
    const loadModels = async () => {
        try {
            // Restart Model (Left)
            const restartResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "restart.glb", scene);
            if (isDisposed) {
                restartResult.meshes.forEach(m => m.dispose());
                return;
            }
            restartMesh = restartResult.meshes[0];
            restartMesh.position.x = -2.5; // Left
            restartMesh.position.y = 0;
            restartMesh.scaling.setAll(0.5); 
            
            // Apply layer mask to all children
            restartResult.meshes.forEach(m => {
                m.layerMask = UI_LAYER_MASK;
                m.isPickable = false;
            });

            // Stop Model (Right)
            const stopResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "stop.glb", scene);
            if (isDisposed) {
                stopResult.meshes.forEach(m => m.dispose());
                return;
            }
            stopMesh = stopResult.meshes[0];
            stopMesh.position.x = 2.5; // Right
            stopMesh.position.y = 0;
            stopMesh.scaling.setAll(0.5); 

            stopResult.meshes.forEach(m => {
                m.layerMask = UI_LAYER_MASK;
                m.isPickable = false;
            });

        } catch (err) {
            console.error("Error loading game over models:", err);
        }
    };
    loadModels();

    // Logic Loop
    const MAX_LEAN = 20; // Degrees
    const THRESHOLD = 3; // Degrees to trigger
    let triggerTimer = 0;

    const observer = scene.onBeforeRenderObservable.add(() => {
        const roll = sensorData.roll || 0;
        
        // Update Bar
        const clampedRoll = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, roll));
        const xPos = (clampedRoll / MAX_LEAN) * 190; // Keep inside padding
        indicator.left = `${xPos}px`;

        // Color feedback
        if (roll < -THRESHOLD) {
            indicator.background = "#00ff00"; // Green for restart
            if (restartMesh) restartMesh.scaling.setAll(0.6); // Pulse effect
            if (stopMesh) stopMesh.scaling.setAll(0.5);
            
            triggerTimer += scene.getEngine().getDeltaTime();
            if (triggerTimer > 1000) { // Hold for 1 second
                cleanup();
                if (onRestart) onRestart();
            }
        } else if (roll > THRESHOLD) {
            indicator.background = "#ff0000"; // Red for stop
            if (stopMesh) stopMesh.scaling.setAll(0.6);
            if (restartMesh) restartMesh.scaling.setAll(0.5);

            triggerTimer += scene.getEngine().getDeltaTime();
            if (triggerTimer > 1000) {
                cleanup();
                if (onQuit) onQuit();
            }
        } else {
            indicator.background = "#00BFFF"; // Neutral
            triggerTimer = 0;
            if (restartMesh) restartMesh.scaling.setAll(0.5);
            if (stopMesh) stopMesh.scaling.setAll(0.5);
        }
    });

    const cleanup = () => {
        isDisposed = true;
        if (guiTexture) guiTexture.dispose();
        if (uiCamera) {
            const index = scene.activeCameras.indexOf(uiCamera);
            if (index !== -1) scene.activeCameras.splice(index, 1);
            uiCamera.dispose();
        }
        if (light) light.dispose();
        if (restartMesh) {
            restartMesh.dispose();
        }
        if (stopMesh) stopMesh.dispose();
        if (observer) scene.onBeforeRenderObservable.remove(observer);
    };

    return {
        guiTexture,
        dispose: cleanup
    };
};

const showReadyPopup = (scene, onReady) => {
    //blur Effect on Main Camera
    const mainCamera = scene.activeCamera;
    const blurH = new BABYLON.BlurPostProcess("Horizontal blur", new BABYLON.Vector2(1.0, 0), 32, 1.0, mainCamera);
    const blurV = new BABYLON.BlurPostProcess("Vertical blur", new BABYLON.Vector2(0, 1.0), 32, 1.0, mainCamera);

    //setup UI Camera (No Blur)
    const uiCamera = new BABYLON.FreeCamera("uiCamera", new BABYLON.Vector3(0, 0, -10), scene);
    uiCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    uiCamera.layerMask = 0x10000000; //unique mask for UI
    
    //manage active cameras
    const originalActiveCameras = scene.activeCameras ? [...scene.activeCameras] : null;
    if (!scene.activeCameras || scene.activeCameras.length === 0) {
        scene.activeCameras = [mainCamera];
    }
    scene.activeCameras.push(uiCamera);

    //UI
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("ReadyUI", true, scene);
    advancedTexture.layer.layerMask = 0x10000000; //only render on UI Camera
    
    //dark overlay
    const overlay = new GUI.Rectangle();
    overlay.width = "100%";
    overlay.height = "100%";
    overlay.background = "black";
    overlay.alpha = 0.3;
    overlay.thickness = 0;
    advancedTexture.addControl(overlay);

    const popupImage = new GUI.Image("popupImage", "assets/images/game-popup.png");
    popupImage.width = "85%";
    popupImage.height = "85%";
    popupImage.stretch = GUI.Image.STRETCH_UNIFORM;
    popupImage.top = "-70px";
    advancedTexture.addControl(popupImage);

    const startGif = createGifOverlay("startGif", "assets/gifs/starten.gif", {
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "40%",
        height: "auto"
    });

    //sensor Logic
    let lastRoll = sensorData.roll;
    let energy = 0;
    const MAX_ENERGY = 50; 

    const observer = scene.onBeforeRenderObservable.add(() => {
        //allow click or sensor shake
        if (sensorData.isConnected) {
            const currentRoll = sensorData.roll;
            const delta = Math.abs(currentRoll - lastRoll);
            lastRoll = currentRoll;

            if (delta > 0.1) energy += delta * 5.0;
            energy *= 0.95;

            if (energy > MAX_ENERGY) {
                finish();
            }
        }
    });

    const finish = () => {
        scene.onBeforeRenderObservable.remove(observer);
        const gif = document.getElementById("startGif");
        if (gif) gif.remove();
        //cleanup Blur
        blurH.dispose();
        blurV.dispose();
        //cleanup UI
        advancedTexture.dispose();
        //cleanup Camera
        uiCamera.dispose();
        if (originalActiveCameras) {
            scene.activeCameras = originalActiveCameras;
        } else {
            scene.activeCameras = [];
            scene.activeCamera = mainCamera;
        }

        onReady();
    };
    
    //fallback click
    popupImage.isPointerBlocker = true;
    popupImage.onPointerUpObservable.add(finish);
};

export const createIdleScreen = (scene, countdown, levelManager) => {
    const gameState = {
        isPlaying: false,
    };

    //preload video texture (paused initially)
    const introVideoTexture = new BABYLON.VideoTexture("introVideo", "assets/animations/intro-sound.mp4", scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, {
        autoPlay: false,
        loop: false,
        autoUpdateTexture: true
    });
    
    //ensure it doesn't play yet
    if (introVideoTexture.video) {
        introVideoTexture.video.pause();
        introVideoTexture.video.currentTime = 0;
    }

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("IdleUI", true, scene);

    //full screen idle image
    const idleImage = new GUI.Image("idleImage", "assets/images/IdleState.png");
    idleImage.width = "100%";
    idleImage.height = "100%";
    idleImage.stretch = GUI.Image.STRETCH_FILL; 
    
    //make it clickable
    idleImage.isPointerBlocker = true;
    idleImage.hoverCursor = "pointer";

    guiTexture.addControl(idleImage);

    const idleGif = createGifOverlay("idleGif", "assets/gifs/idlescreen.gif", {
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "40%",
        height: "auto"
    });

    //white Overlay for Witmotion Start
    const whiteOverlay = new GUI.Rectangle("whiteOverlay");
    whiteOverlay.width = "100%";
    whiteOverlay.height = "100%";
    whiteOverlay.background = "white";
    whiteOverlay.alpha = 0;
    whiteOverlay.thickness = 0;
    whiteOverlay.isHitTestVisible = false; // Let clicks pass through
    whiteOverlay.zIndex = 5; 
    guiTexture.addControl(whiteOverlay);

    //witmotion Connect Button (Top Left)
    const connectBtn = GUI.Button.CreateSimpleButton("connectBtn");
    connectBtn.width = "20px";
    connectBtn.height = "20px";
    connectBtn.color = "white";
    connectBtn.background = "#404040";
    connectBtn.cornerRadius = 20;
    connectBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    connectBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    connectBtn.left = "20px";
    connectBtn.top = "20px";
    connectBtn.zIndex = 10;

    connectBtn.onPointerUpObservable.add(async () => {
        //resume audio context on user interaction
        if (BABYLON.Engine.audioEngine && BABYLON.Engine.audioEngine.audioContext) {
            BABYLON.Engine.audioEngine.audioContext.resume();
        }

        const connected = await connectToWitMotion();
        if (connected) {
            connectBtn.background = "green";
        } else {
            console.warn("Witmotion connection failed or cancelled");
            connectBtn.background = "red";
        }
    });

    //listen for unexpected disconnections
    onWitmotionDisconnect(() => {
        connectBtn.background = "red";
    });

    guiTexture.addControl(connectBtn);

    //helper to start game
    let motionObserver = null;
    const playIntroAndStart = () => {
        if (gameState.isPlaying) return;
        gameState.isPlaying = true;

        if (motionObserver) {
            scene.onBeforeRenderObservable.remove(motionObserver);
        }
        guiTexture.dispose();
        
        const gif = document.getElementById("idleGif");
        if (gif) gif.remove();

        //create video layer using preloaded texture
        const videoLayer = new BABYLON.Layer("introLayer", null, scene, false);
        videoLayer.texture = introVideoTexture;
        
        const videoElement = introVideoTexture.video;
        
        videoElement.onended = () => {
            console.log("Video ended");
            
            //transition
            const transitionTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("TransitionUI", true, scene);
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
                { frame: 45, value: 1 } //0.75s fade to black
            ]);

            scene.beginDirectAnimation(blackScreen, [fadeAnim], 0, 45, false, 1, () => {
                //cleanup video
                introVideoTexture.dispose();
                videoLayer.dispose();

                showReadyPopup(scene, () => {
                    countdown.startCountdown(() => {
                        levelManager.startFirstLevel();
                    });
                });

                //fade out black screen to reveal game
                const fadeOutAnim = new BABYLON.Animation("fadeOut", "alpha", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                fadeOutAnim.setKeys([
                    { frame: 0, value: 1 },
                    { frame: 60, value: 0 } // 1s fade out
                ]);

                scene.beginDirectAnimation(blackScreen, [fadeOutAnim], 0, 60, false, 1, () => {
                    transitionTexture.dispose();
                });
            });
        };
        
        videoElement.onerror = (e) => {
            console.error("Video error:", e);
            introVideoTexture.dispose();
            videoLayer.dispose();
            countdown.startCountdown(() => {
                levelManager.startFirstLevel();
            });
        };

        //ensure it plays
        videoElement.play().catch(e => {
            console.warn("Video play failed (autoplay policy?):", e);
            introVideoTexture.dispose();
            videoLayer.dispose();
            countdown.startCountdown(() => {
                levelManager.startFirstLevel();
            });
        });
    };

    //motion detection logic
    let lastRoll = sensorData.roll;
    let energy = 0;
    let currentAlpha = 0;
    let firstFrame = true;
    const MAX_ENERGY = 100;
    
    motionObserver = scene.onBeforeRenderObservable.add(() => {
        if (!sensorData.isConnected || gameState.isPlaying) {
            firstFrame = true;
            return;
        }

        const currentRoll = sensorData.roll;

        if (firstFrame) {
            lastRoll = currentRoll;
            firstFrame = false;
            return;
        }

        const delta = Math.abs(currentRoll - lastRoll);
        lastRoll = currentRoll;

        //accumulate energy based on movement intensity
        if (delta > 0.1) { 
            energy += delta * 5.0;
        }

        //decay energy
        energy *= 0.96;

        //clamp energy
        energy = Math.max(0, Math.min(energy, MAX_ENERGY));
        
        //smoothly interpolate the visual alpha
        const targetAlpha = energy / MAX_ENERGY;
        currentAlpha = BABYLON.Scalar.Lerp(currentAlpha, targetAlpha, 0.1);
        whiteOverlay.alpha = currentAlpha;

        //trigger start when screen is mostly white
        if (energy >= MAX_ENERGY * 0.98) { 
            playIntroAndStart();
        }
    });

    //click logic for game start
    idleImage.onPointerUpObservable.add(() => {
        // Resume audio context on user interaction
        if (BABYLON.Engine.audioEngine && BABYLON.Engine.audioEngine.audioContext) {
            BABYLON.Engine.audioEngine.audioContext.resume();
        }
        playIntroAndStart();
    });

    return gameState;
};

//helper to create HTML Overlay for GIFs
const createGifOverlay = (id, src, styles) => {
    const img = document.createElement('img');
    img.id = id;
    img.src = src;
    Object.assign(img.style, {
        position: 'absolute',
        zIndex: '1000',
        pointerEvents: 'none',
        ...styles
    });
    document.body.appendChild(img);
    return img;
};