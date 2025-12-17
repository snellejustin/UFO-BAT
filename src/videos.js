import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createFadeTransition } from './effects.js';

//helper to fit video texture to screen (cover mode)
export const fitVideoToScreen = (layer, scene) => {
    const updateScale = () => {
        const texture = layer.texture;
        if (!texture || !texture.video) return;

        const video = texture.video;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const screenWidth = scene.getEngine().getRenderWidth();
        const screenHeight = scene.getEngine().getRenderHeight();

        if (videoWidth === 0 || videoHeight === 0) return;

        const videoRatio = videoWidth / videoHeight;
        const screenRatio = screenWidth / screenHeight;

        //reset
        texture.uScale = 1;
        texture.vScale = 1;
        texture.uOffset = 0;
        texture.vOffset = 0;

        if (screenRatio > videoRatio) {
            //screen is wider than video -> Fit width, crop height
            const scale = videoRatio / screenRatio;
            texture.vScale = scale;
            texture.vOffset = (1 - scale) / 2;
        } else {
            //screen is taller than video -> Fit height, crop width
            const scale = screenRatio / videoRatio;
            texture.uScale = scale;
            texture.uOffset = (1 - scale) / 2;
        }
    };
    
    //resize observer
    const observer = scene.onBeforeRenderObservable.add(updateScale);
    
    //return cleanup function
    return () => {
        scene.onBeforeRenderObservable.remove(observer);
    };
};

export const preloadVideoTextures = (scene) => {
    const textures = {};
    
    const videos = [
        { key: 'intro', path: 'assets/animations/intro-sound.mp4' },
        { key: 'outro', path: 'assets/animations/end_anim_f.mp4' },
        { key: 'gameover', path: 'assets/animations/gameover_anim.mp4' },
        { key: 'victory', path: 'assets/animations/victory_screen.mp4' }
    ];

    videos.forEach(v => {
        const texture = new BABYLON.VideoTexture(v.key + "Video", v.path, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, {
            autoPlay: false,
            loop: false,
            autoUpdateTexture: true
        });
        
        if (texture.video) {
            texture.video.pause();
            texture.video.currentTime = 0;
            texture.video.setAttribute('playsinline', 'true');
        }
        
        textures[v.key] = texture;
    });

    return textures;
};

export const playEndSequence = (scene, outroTexture, victoryTexture, onComplete) => {
    if (typeof victoryTexture === 'function') {
        onComplete = victoryTexture;
        victoryTexture = null;
    }
    
    //create video layer
    const videoLayer = new BABYLON.Layer("endVideoLayer", null, scene, false);
    
    let currentVideoTexture;
    if (outroTexture) {
        currentVideoTexture = outroTexture;
    } else {
        currentVideoTexture = new BABYLON.VideoTexture("endVideo", "assets/animations/end_anim_f.mp4", scene, true, false, BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE, {
            autoPlay: false,
            loop: false,
            volume: 0.4,
            autoUpdateTexture: true
        });
    }

    videoLayer.texture = currentVideoTexture;
    const stopFitting = fitVideoToScreen(videoLayer, scene);
    const videoElement = currentVideoTexture.video;
    
    //critical for mobile/some browsers
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = false;
    videoElement.currentTime = 0;

    const playVictory = () => {
        videoElement.onended = null;

        if (victoryTexture) {
             // Switch texture
             videoLayer.texture = victoryTexture;
             const victoryElement = victoryTexture.video;
             victoryElement.setAttribute('playsinline', 'true');
             victoryElement.muted = false;
             victoryElement.currentTime = 0;
             victoryElement.volume = 0.4;
             
             victoryElement.onended = cleanup;
             
             const playPromise = victoryElement.play();
             if (playPromise !== undefined) {
                 playPromise.catch(e => {
                     console.warn("Victory video play failed:", e);
                     victoryElement.muted = true;
                     victoryElement.play().catch(e2 => {
                         console.error("Victory video play failed again:", e2);
                         cleanup();
                     });
                 });
             }
        } else {
            cleanup();
        }
    };

    const cleanup = () => {
        stopFitting();
        if (victoryTexture && victoryTexture.video) {
            victoryTexture.video.onended = null;
        }
        
        createFadeTransition(scene, () => {
            videoLayer.dispose();
            
            if (!outroTexture) currentVideoTexture.dispose(); //only dispose if we created it locally
            
            if (onComplete) onComplete();
        });
    };

    videoElement.onended = playVictory;

    //ensure video plays
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("End video play failed:", e);
            //try muted if unmuted failed (autoplay policy)
            videoElement.muted = true;
            videoElement.play().catch(e2 => {
                console.error("End video play failed again:", e2);
                playVictory(); //skip to next or cleanup
            });
        });
    }
};

export const playGameOverSequence = (scene, preloadedTexture, onComplete) => {
    if (typeof preloadedTexture === 'function') {
        onComplete = preloadedTexture;
        preloadedTexture = null;
    }

    //create video layer
    const videoLayer = new BABYLON.Layer("gameoverVideoLayer", null, scene, false);
    
    let videoTexture;
    if (preloadedTexture) {
        videoTexture = preloadedTexture;
    } else {
        videoTexture = new BABYLON.VideoTexture("gameoverVideo", "assets/animations/gameover_anim.mp4", scene, true, false, BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE, {
            autoPlay: false,
            loop: false,
            autoUpdateTexture: true,
            volume: 0.4
        });
    }

    videoLayer.texture = videoTexture;
    const stopFitting = fitVideoToScreen(videoLayer, scene);
    const videoElement = videoTexture.video;
    
    //critical for mobile/some browsers
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = false;
    
    // Force reset state
    videoElement.pause();
    videoElement.currentTime = 0;

    const cleanup = () => {
        stopFitting();
        if (typeof safetyTimeout !== 'undefined') clearTimeout(safetyTimeout);
        videoElement.onended = null;
        
        createFadeTransition(scene, () => {
            videoLayer.dispose();
            
            if (!preloadedTexture) videoTexture.dispose(); //only dispose if we created it locally
            
            if (onComplete) onComplete();
        });
    };

    videoElement.onended = cleanup;

    //safety timeout in case onended doesn't fire
    const safetyTimeout = setTimeout(() => {
        console.warn("Video timeout reached, forcing cleanup");
        cleanup();
    }, (videoElement.duration || 10) * 1000 + 1000); //duration + 1s buffer, default 10s

    //ensure video plays
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("Game over video play failed:", e);
            clearTimeout(safetyTimeout);
            //try muted if unmuted failed (autoplay policy)
            videoElement.muted = true;
            videoElement.play().catch(e2 => {
                console.error("Game over video play failed again:", e2);
                cleanup();
            });
        });
    } else {
    }
};
