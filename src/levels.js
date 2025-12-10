import * as GUI from "@babylonjs/gui";
import { Animation } from "@babylonjs/core";
import { sensorData } from "./witmotion.js";
import { createCowManager } from "./cow.js";

export const createLevelManager = (scene, asteroidSystem, ufo, healthBoost, shield, projectileManager, rocketShooter, levelProgressBar) => {
    let currentLevelIndex = 0;
    let isWaveActive = false;
    let activeTimers = [];
    let activeObservers = [];
    let guiTexture = null;
    let levelTextControl = null;
    let instructionTextControl = null;
    let hasCompletedPractice = false;
    const cowManager = createCowManager(scene);

    const levels = [
        {
            level: 1,
            duration: 10000,
            asteroidSpeed: { min: 3, max: 5 },
            spawnRate: 0.5,
            ufoModel: "ufoalien1.glb",
            projectileConfig: {
                size: 0.2,
                color: { r: 0.063, g: 0.992, b: 0.847 },
                glowIntensity: 1.0
            },
            ufoConfig: {
                pathPoints: 5,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 5, max: 7 },
                timePerPoint: 2500,
                totalShots: 3,
                enterDuration: 2000,
                exitDuration: 1000,
                projectileSpeed: -4
            }
        },
        {
            level: 2,
            duration: 12000,
            asteroidSpeed: { min: 3, max: 6 },
            spawnRate: 0.7,
            ufoModel: "ufoalien2.glb",
            projectileConfig: {
                size: 0.7,
                color: { r: 0.6, g: 0.0, b: 1.0 },
                glowIntensity: 1.2
            },
            ufoConfig: {
                pathPoints: 7,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 4.5, max: 7 },
                timePerPoint: 2200,
                totalShots: 5,
                enterDuration: 1800,
                exitDuration: 1000,
                projectileSpeed: -5
            }
        },
        {
            level: 3,
            duration: 15000,
            asteroidSpeed: { min: 4, max: 6 },
            spawnRate: 1,
            ufoModel: "ufoalien3.glb",
            projectileConfig: {
                size: 0.2,
                color: { r: 1.0, g: 0.4, b: 0.0 },
                glowIntensity: 1.5
            },
            ufoConfig: {
                pathPoints: 7,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 4, max: 7 },
                timePerPoint: 2000,
                totalShots: 5,
                enterDuration: 1600,
                exitDuration: 900,
                projectileSpeed: -6,
                // shootingPattern: "spread"
            }
        },
        {
            level: 4,
            duration: 20000,
            asteroidSpeed: { min: 6, max: 8 },
            spawnRate: 1,
            ufoModel: "ufoalien4.glb",
            projectileConfig: {
                size: 0.2,
                color: { r: 1.0, g: 1.0, b: 0.0 },
                glowIntensity: 1.8
            },
            ufoConfig: {
                pathPoints: 7,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 3.5, max: 7.5 },
                timePerPoint: 1800,
                totalShots: 5,
                enterDuration: 1400,
                exitDuration: 800,
                projectileSpeed: -7,
                // shootingPattern: "tripleSpread"
            },
        },
        {
            level: 5,
            duration: 22000,
            asteroidSpeed: { min: 6, max: 8 },
            spawnRate: 1,
            ufoModel: "ufoalienboss.glb",
            projectileConfig: {
                size: 1,
                color: { r: 0.0, g: 0.1, b: 0.5 },
                glowIntensity: 2.0
            },
            ufoConfig: {
                pathPoints: 8,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 5, max: 9 },
                timePerPoint: 1600,
                totalShots: 6,
                enterDuration: 1200,
                exitDuration: 700,
                projectileSpeed: -3
            },
            hasBossEvent: true
        }
    ];

    const safeTimeout = (callback, delay) => {
        const id = setTimeout(() => {
            activeTimers = activeTimers.filter(t => t !== id);
            callback();
        }, delay);
        activeTimers.push(id);
        return id;
    };

    const clearAllTimers = () => {
        activeTimers.forEach(id => clearTimeout(id));
        activeTimers = [];
    };

    const setupGUI = () => {
        if (guiTexture) return;

        guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("LevelUI", true, scene);

        levelTextControl = new GUI.TextBlock();
        levelTextControl.text = "";
        levelTextControl.color = "rgb(255, 187, 0)";
        levelTextControl.fontFamily = "GameFont, Arial, sans-serif";
        levelTextControl.fontWeight = "bold";
        levelTextControl.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        levelTextControl.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

        guiTexture.addControl(levelTextControl);

        instructionTextControl = new GUI.TextBlock();
        instructionTextControl.text = "";
        instructionTextControl.color = "#ffffff";
        instructionTextControl.fontSize = 60;
        instructionTextControl.fontFamily = "GameFont, Arial, sans-serif";
        instructionTextControl.fontWeight = "bold";
        instructionTextControl.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        instructionTextControl.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        instructionTextControl.isVisible = false;
        guiTexture.addControl(instructionTextControl);
    };
    const animateGuiMove = (control, targetFontSize, targetLeft, targetTop, duration, callback) => {
        const fps = 60;
        const totalFrames = (duration / 1000) * fps;
        const startFontSize = control.fontSizeInPixels;
        const startLeft = control.leftInPixels;
        const startTop = control.topInPixels;

        let frame = 0;

        const observer = scene.onBeforeRenderObservable.add(() => {
            frame++;
            const progress = frame / totalFrames;

            //smoothstep
            const ease = progress * progress * (3 - 2 * progress);

            //interpolatie
            const currentSize = startFontSize + (targetFontSize - startFontSize) * ease;
            const currentLeft = startLeft + (targetLeft - startLeft) * ease;
            const currentTop = startTop + (targetTop - startTop) * ease;

            control.fontSize = currentSize;
            control.left = `${currentLeft}px`;
            control.top = `${currentTop}px`;

            if (progress >= 1) {
                scene.onBeforeRenderObservable.remove(observer);
                if (callback) callback();
            }
        });

        //voor cleanup achteraf
        activeObservers.push(observer);
    };

    const announceLevel = (levelInput, onComplete) => {
        if (!guiTexture) setupGUI();

        if (typeof levelInput === 'string') {
            levelTextControl.text = levelInput;
        } else {
            levelTextControl.text = `LEVEL ${levelInput}`;
        }

        levelTextControl.isVisible = true;
        levelTextControl.fontSize = 80;
        levelTextControl.left = "0px";
        levelTextControl.top = "0px";
        levelTextControl.alpha = 1;

        safeTimeout(() => {
            const engine = scene.getEngine();
            const width = engine.getRenderWidth();
            const height = engine.getRenderHeight();

            const targetLeft = -(width / 2) + 60;
            const targetTop = -(height / 2) + 40;

            //animatie naar hoek
            animateGuiMove(levelTextControl, 32, targetLeft, targetTop, 800, () => {

                if (onComplete) onComplete();
            });

        }, 1000);
    };

    const startPracticeLevel = () => {
        isWaveActive = true;

        announceLevel("OEFENEN", () => {
            if (!guiTexture) setupGUI();
            
            //helper to show GIF via HTML Overlay
            const showGif = (name) => {
                return createGifOverlay("practiceGif", `assets/gifs/${name}`, {
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "400px",
                    height: "auto"
                });
            };

            let currentGif = showGif("Leun_naar_links.gif");
            instructionTextControl.isVisible = false;

            const checkLeft = scene.onBeforeRenderObservable.add(() => {
                if (sensorData.roll < -3) {
                    scene.onBeforeRenderObservable.remove(checkLeft);
                    
                    if (currentGif) {
                        currentGif.remove();
                        currentGif = null;
                    }

                    instructionTextControl.text = "Goed!";
                    instructionTextControl.isVisible = true;
                    
                    safeTimeout(() => {
                        instructionTextControl.isVisible = false;
                        currentGif = showGif("Leun_naar_rechts.gif");
                        
                        const checkRight = scene.onBeforeRenderObservable.add(() => {
                            if (sensorData.roll > 3) {
                                scene.onBeforeRenderObservable.remove(checkRight);
                                
                                if (currentGif) {
                                    currentGif.remove();
                                    currentGif = null;
                                }

                                instructionTextControl.text = "Klaar!";
                                instructionTextControl.isVisible = true;
                                
                                safeTimeout(() => {
                                    instructionTextControl.isVisible = false;
                                    hasCompletedPractice = true;
                                    startWave(0);
                                }, 1500);
                            }
                        });
                        activeObservers.push(checkRight);
                        
                    }, 1500);
                }
            });
            activeObservers.push(checkLeft);
        });
    };

    const startWave = (levelIndex) => {
        if (levelIndex >= levels.length) return false;

        currentLevelIndex = levelIndex;
        const levelConfig = levels[currentLevelIndex];
        isWaveActive = true;

        //start progress animation for asteroid phase (80% of level progress)
        if (levelProgressBar) {
            const totalLevels = levels.length;
            const asteroidEndPercent = ((currentLevelIndex + 0.8) / totalLevels) * 100;
            levelProgressBar.animateTo(asteroidEndPercent, levelConfig.duration);
        }

        //for boss levels, don't set model yet (wait for rocket shooter pickup)
        const isBossLevel = levelConfig.hasBossEvent;

        if (!isBossLevel) {
            if (ufo.setModel && levelConfig.ufoModel) {
                ufo.setModel(levelConfig.ufoModel);
            } else if (ufo.loadNewModel) {
                //fallback naar oude methode
                ufo.loadNewModel(levelConfig.ufoModel);
            }
        }

        if (projectileManager?.setProjectileConfig && levelConfig.projectileConfig) {
            projectileManager.setProjectileConfig(levelConfig.projectileConfig);
        }

        announceLevel(levelConfig.level, () => {
            asteroidSystem.manager.isActive = true;
            asteroidSystem.manager.spawnRatePerSecond = levelConfig.spawnRate;
            asteroidSystem.manager.speedMin = levelConfig.asteroidSpeed.min;
            asteroidSystem.manager.speedMax = levelConfig.asteroidSpeed.max;

            //powerups with guaranteed spacing to avoid double spawns
            const powerups = [];
            if (healthBoost) powerups.push(healthBoost);
            if (shield) powerups.push(shield);

            if (powerups.length > 0) {
                //divide the level duration into segments for each powerup
                const minSpacing = 2000;
                const safeWindow = levelConfig.duration - 3000;

                powerups.forEach((powerup, index) => {
                    //delays ensuring they don't overlap
                    let delay;
                    if (powerups.length === 1) {
                        delay = Math.random() * safeWindow;
                    } else {
                        //split timeline into segments with spacing
                        const segmentSize = safeWindow / powerups.length;
                        delay = (segmentSize * index) + (Math.random() * (segmentSize - minSpacing));
                    }

                    safeTimeout(() => {
                        //pass asteroid system to check for collisions
                        if (powerup.spawnPowerup) {
                            powerup.spawnPowerup(asteroidSystem);
                        }
                    }, delay);
                });
            }
            safeTimeout(() => endWave(), levelConfig.duration);
        });

        return true;
    };

    const endWave = (skipTransition = false) => {
        isWaveActive = false;
        asteroidSystem.manager.isActive = false;

        if (levelTextControl) {
            levelTextControl.isVisible = false;
        }

        if (skipTransition) return;
        if (!levels[currentLevelIndex]) return;

        const levelConfig = levels[currentLevelIndex];

        //spawn floating cow (Left->Right for even levels, Right->Left for odd levels)
        const direction = currentLevelIndex % 2 === 0 ? 'left-to-right' : 'right-to-left';
        cowManager.spawnCow(direction);

        //start progress animation for boss phase (remaining 20%)
        if (levelProgressBar) {
            const totalLevels = levels.length;
            const levelEndPercent = ((currentLevelIndex + 1) / totalLevels) * 100;
            
            //calculate estimated boss duration based on UFO config
            const ufoConfig = levelConfig.ufoConfig;
            const estimatedBossDuration = (ufoConfig.enterDuration || 2000) + 
                                          (ufoConfig.exitDuration || 1000) + 
                                          ((ufoConfig.pathPoints || 5) * (ufoConfig.timePerPoint || 2000));

            levelProgressBar.animateTo(levelEndPercent, estimatedBossDuration);
        }

        //check for boss event (Rocket Shooter)
        const isRocketLevel = levelConfig.hasBossEvent;

        if (isRocketLevel && rocketShooter) {
            safeTimeout(() => {
                rocketShooter.spawnPowerup((collected) => {
                    if (collected) {
                        startUfoPhase();
                    }
                });
            }, 1000);
        } else {
            safeTimeout(() => {
                startUfoPhase();
            }, 1000);
        }
    };

    const startUfoPhase = () => {
        const currentLevelConfig = levels[currentLevelIndex];

        //set boss model now (right before flying)
        if (currentLevelConfig.hasBossEvent && currentLevelConfig.ufoModel) {
            if (ufo.setModel) {
                ufo.setModel(currentLevelConfig.ufoModel);
            } else if (ufo.loadNewModel) {
                ufo.loadNewModel(currentLevelConfig.ufoModel);
            }
        }

        ufo.flyUFO(() => {
            safeTimeout(() => {
                if (currentLevelIndex + 1 < levels.length) {
                    startWave(currentLevelIndex + 1);
                }
            }, 3000);
        }, currentLevelConfig.ufoConfig);
    };

    const startFirstLevel = () => {
        if (!hasCompletedPractice) {
            startPracticeLevel();
        } else {
            startWave(0);
        }
    };

    const reset = () => {
        clearAllTimers();
        isWaveActive = false;
        currentLevelIndex = 0;
        asteroidSystem.manager.isActive = false;
        cowManager.reset();

        if (levelTextControl) {
            levelTextControl.isVisible = false;
        }

        activeObservers.forEach(obs => {
            scene.onBeforeRenderObservable.remove(obs);
        });
        activeObservers = [];
    };

    //functie pauzeert alles (timers, spawns) maar reset het level NIET.
    //roepen we aan bij Game Over.
    const stop = () => {
        clearAllTimers(); //stop nieuwe waves/events
        isWaveActive = false;
        asteroidSystem.manager.isActive = false;

        //stop lopende animaties/observers
        activeObservers.forEach(obs => {
            scene.onBeforeRenderObservable.remove(obs);
        });
        activeObservers = [];

        if (levelTextControl) {
            levelTextControl.isVisible = false;
        }
    };

    const cleanup = () => {
        clearAllTimers();
        if (guiTexture) {
            guiTexture.dispose();
            guiTexture = null;
        }
        activeObservers.forEach(obs => {
            scene.onBeforeRenderObservable.remove(obs);
        });
        activeObservers = [];
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

    return {
        startFirstLevel,
        reset,
        stop,
        cleanup,
        resetPracticeState: () => { hasCompletedPractice = false; },
        getCurrentLevel: () => currentLevelIndex + 1,
        isWaveActive: () => isWaveActive,
        levels
    };
};