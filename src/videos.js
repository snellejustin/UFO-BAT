import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createFadeTransition } from './effects.js';

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
    // Handle optional arguments if victoryTexture is missing (backward compatibility or if not provided)
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
            autoUpdateTexture: true
        });
    }

    videoLayer.texture = currentVideoTexture;
    const videoElement = currentVideoTexture.video;
    
    //critical for mobile/some browsers
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = false;
    videoElement.currentTime = 0;

    const playVictory = () => {
        videoElement.onended = null;

        // If we have a victory texture, play it
        if (victoryTexture) {
             // Switch texture
             videoLayer.texture = victoryTexture;
             const victoryElement = victoryTexture.video;
             victoryElement.setAttribute('playsinline', 'true');
             victoryElement.muted = false;
             victoryElement.currentTime = 0;
             
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
            // If no victory texture, just cleanup
            cleanup();
        }
    };

    const cleanup = () => {
        if (victoryTexture && victoryTexture.video) {
            victoryTexture.video.onended = null;
        }
        
        createFadeTransition(scene, () => {
            videoLayer.dispose();
            
            if (!outroTexture) currentVideoTexture.dispose(); // Only dispose if we created it locally
            
            if (onComplete) onComplete();
        });
    };

    videoElement.onended = playVictory;

    // Ensure video plays
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("End video play failed:", e);
            // Try muted if unmuted failed (autoplay policy)
            videoElement.muted = true;
            videoElement.play().catch(e2 => {
                console.error("End video play failed again:", e2);
                playVictory(); // Skip to next or cleanup
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
            autoUpdateTexture: true
        });
    }

    videoLayer.texture = videoTexture;
    const videoElement = videoTexture.video;
    
    //critical for mobile/some browsers
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = false;
    
    // Force reset state
    videoElement.pause();
    videoElement.currentTime = 0;

    const cleanup = () => {
        if (typeof safetyTimeout !== 'undefined') clearTimeout(safetyTimeout);
        videoElement.onended = null;
        
        createFadeTransition(scene, () => {
            videoLayer.dispose();
            
            if (!preloadedTexture) videoTexture.dispose(); // Only dispose if we created it locally
            
            if (onComplete) onComplete();
        });
    };

    videoElement.onended = cleanup;

    // Safety timeout in case onended doesn't fire
    const safetyTimeout = setTimeout(() => {
        console.warn("Video timeout reached, forcing cleanup");
        cleanup();
    }, (videoElement.duration || 10) * 1000 + 1000); // Duration + 1s buffer, default 10s

    // Ensure video plays
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("Game over video play failed:", e);
            clearTimeout(safetyTimeout);
            // Try muted if unmuted failed (autoplay policy)
            videoElement.muted = true;
            videoElement.play().catch(e2 => {
                console.error("Game over video play failed again:", e2);
                cleanup();
            });
        });
    } else {
        // If play() returns undefined (older browsers), we still keep the timeout
    }
};
