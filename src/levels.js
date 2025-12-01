import * as GUI from "@babylonjs/gui";
import { Animation } from "@babylonjs/core";

export const createLevelManager = (scene, asteroidSystem, ufo, healthBoost, shield, projectileManager, rocketShooter) => {
    let currentLevelIndex = 0;
    let isWaveActive = false;
    let activeTimers = []; 
    let activeObservers = [];
    let guiTexture = null;
    let levelTextControl = null;
   

    const levels = [
        {
            level: 1,
            duration: 12000,
            asteroidSpeed: { min: 3, max: 6 },
            spawnRate: 0.5,
            ufoModel: "ufoalien1.glb",
            projectileConfig: { 
                size: 0.2, 
                color: { r: 0.063, g: 0.992, b: 0.847 }, 
                glowIntensity: 1.0 },
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
            duration: 15000,
            asteroidSpeed: { min: 4, max: 8 },
            spawnRate: 0.7,
            ufoModel: "ufoalien2.glb",
            projectileConfig: { 
                size: 0.7, 
                color: { r: 0.6, g: 0.0, b: 1.0 }, 
                glowIntensity: 1.2 },
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
            duration: 18000,
            asteroidSpeed: { min: 5, max: 10 },
            spawnRate: 1,
            ufoModel: "ufoalien3.glb",
            projectileConfig: { 
                size: 0.2, 
                color: { r: 1.0, g: 0.4, b: 0.0 },
                glowIntensity: 1.5 },
            ufoConfig: {
                pathPoints: 7, 
                pathXRange: { min: -7, max: 7 }, 
                pathYRange: { min: 4, max: 7 },
                timePerPoint: 2000, 
                totalShots: 5, 
                enterDuration: 1600, 
                exitDuration: 900, 
                projectileSpeed: -6, 
                shootingPattern: "spread"
            }
        },
        {
            level: 4,
            duration: 20000,
            asteroidSpeed: { min: 6, max: 12 },
            spawnRate: 1.2,
            ufoModel: "ufoalien4.glb",
            projectileConfig: { 
                size: 0.2, 
                color: { r: 1.0, g: 1.0, b: 0.0 }, 
                glowIntensity: 1.8 },
            ufoConfig: {
                pathPoints: 7, 
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 3.5, max: 7.5 },
                timePerPoint: 1800,
                totalShots: 5, 
                enterDuration: 1400, 
                exitDuration: 800, 
                projectileSpeed: -7, 
                shootingPattern: "tripleSpread"
            },
        },
        {
            level: 5,
            duration: 25000,
            asteroidSpeed: { min: 7, max: 15 },
            spawnRate: 1.5,
            ufoModel: "ufoalienboss.glb",
            projectileConfig: {
                size: 1, 
                color: { r: 0.0, g: 0.1, b: 0.5 },
                glowIntensity: 2.0 },
            ufoConfig: {
                pathPoints: 8, 
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 5, max: 9 },
                timePerPoint: 1600, 
                totalShots: 6, 
                enterDuration: 1200, 
                exitDuration: 700, 
                projectileSpeed: -8
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
        levelTextControl.color = "#00ff00";
        levelTextControl.fontFamily = "Arial, sans-serif";
        levelTextControl.fontWeight = "bold";
        levelTextControl.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        levelTextControl.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

        guiTexture.addControl(levelTextControl);
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

    const announceLevel = (levelNumber, onComplete) => {
        if (!guiTexture) setupGUI();

        levelTextControl.text = `LEVEL ${levelNumber}`;
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

    const startWave = (levelIndex) => {
        if (levelIndex >= levels.length) return false;

        currentLevelIndex = levelIndex;
        const levelConfig = levels[currentLevelIndex];
        isWaveActive = true;

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

    const endWave = () => {
        isWaveActive = false;
        asteroidSystem.manager.isActive = false;

        if (levelTextControl) {
            levelTextControl.isVisible = false;
        }

        const levelConfig = levels[currentLevelIndex];

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
        startWave(0);
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

    return {
        startFirstLevel,
        cleanup,
        getCurrentLevel: () => currentLevelIndex + 1,
        isWaveActive: () => isWaveActive,
        levels
    };
};