export const createLevelManager = (asteroidSystem, ufo, healthBoost, shield) => {
    let currentLevel = 0;
    let isWaveActive = false;
    let waveTimer = null;

    const levels = [
        {
            level: 1,
            duration: 12000,
            asteroidSpeed: { min: 3, max: 6 },
            spawnRate: 1,
            ufoConfig: {
                pathPoints: 4,
                pathXRange: { min: -6, max: 6 },
                pathYRange: { min: 5, max: 7 },
                timePerPoint: 2500,
                totalShots: 2,
                enterDuration: 2000,
                exitDuration: 1000,
                projectileSpeed: -4
            }
        },
        {
            level: 2,
            duration: 15000,
            asteroidSpeed: { min: 4, max: 8 },
            spawnRate: 1.3,
            ufoConfig: {
                pathPoints: 5,
                pathXRange: { min: -7, max: 7 },
                pathYRange: { min: 4.5, max: 7 },
                timePerPoint: 2200,
                totalShots: 3,
                enterDuration: 1800,
                exitDuration: 1000,
                projectileSpeed: -5
            }
        },
        {
            level: 3,
            duration: 18000,
            asteroidSpeed: { min: 5, max: 10 },
            spawnRate: 1.6,
            ufoConfig: {
                pathPoints: 6,
                pathXRange: { min: -8, max: 8 },
                pathYRange: { min: 4, max: 7 },
                timePerPoint: 2000,
                totalShots: 4,
                enterDuration: 1600,
                exitDuration: 900,
                projectileSpeed: -6
            }
        },
        {
            level: 4,
            duration: 20000,
            asteroidSpeed: { min: 6, max: 12 },
            spawnRate: 1.9,
            ufoConfig: {
                pathPoints: 7,
                pathXRange: { min: -9, max: 9 },
                pathYRange: { min: 3.5, max: 7.5 },
                timePerPoint: 1800,
                totalShots: 5,
                enterDuration: 1400,
                exitDuration: 800,
                projectileSpeed: -7
            }
        },
        {
            level: 5,
            duration: 25000,
            asteroidSpeed: { min: 7, max: 15 },
            spawnRate: 2.2,
            ufoConfig: {
                pathPoints: 8,
                pathXRange: { min: -10, max: 10 },
                pathYRange: { min: 3, max: 8 },
                timePerPoint: 1600,
                totalShots: 6,
                enterDuration: 1200,
                exitDuration: 700,
                projectileSpeed: -8
            }
        }
    ];

    const showLevelAnnouncement = (levelNumber, onComplete) => {
        const levelOverlay = document.createElement('div');
        levelOverlay.id = 'level-overlay';
        levelOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 80px;
            font-weight: bold;
            color: #00ff00;
            text-shadow: 0 0 40px rgba(0, 255, 0, 1);
            font-family: 'Arial', sans-serif;
            z-index: 2000;
            transition: all 1s ease;
        `;
        levelOverlay.textContent = `LEVEL ${levelNumber}`;
        document.body.appendChild(levelOverlay);

        setTimeout(() => {
            levelOverlay.style.top = '40px';
            levelOverlay.style.left = '40px';
            levelOverlay.style.transform = 'translate(0, 0)';
            levelOverlay.style.fontSize = '32px';
        }, 800);

        setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 1000);

        return levelOverlay;
    };

    const startWave = (levelIndex) => {
        if (levelIndex >= levels.length) {
            return false;
        }

        currentLevel = levelIndex;
        const levelConfig = levels[currentLevel];
        isWaveActive = true;

        const levelOverlay = showLevelAnnouncement(levelConfig.level, () => {
            asteroidSystem.manager.isActive = true;
            
            asteroidSystem.manager.spawnRatePerSecond = levelConfig.spawnRate;
            asteroidSystem.manager.speedMin = levelConfig.asteroidSpeed.min;
            asteroidSystem.manager.speedMax = levelConfig.asteroidSpeed.max;

            if (healthBoost) {
                const randomDelay = Math.random() * (levelConfig.duration - 3000);
                setTimeout(() => {
                    healthBoost.spawnPowerup();
                }, randomDelay);
            }

            if (shield) {
                const randomDelay = Math.random() * (levelConfig.duration - 3000);
                setTimeout(() => {
                    shield.spawnPowerup();
                }, randomDelay);
            }

            waveTimer = setTimeout(() => {
                endWave(levelOverlay);
            }, levelConfig.duration);
        });

        return true;
    };

    const endWave = (levelOverlay) => {
        isWaveActive = false;
        asteroidSystem.manager.isActive = false;

        if (levelOverlay && levelOverlay.parentNode) {
            levelOverlay.style.opacity = '0';
            setTimeout(() => {
                levelOverlay.remove();
            }, 500);
        }
        
        setTimeout(() => {
            const currentLevelConfig = levels[currentLevel];
            ufo.flyUFO(() => {
                setTimeout(() => {
                    if (currentLevel + 1 < levels.length) {
                        startWave(currentLevel + 1);
                    }
                }, 3000);
            }, currentLevelConfig.ufoConfig);
        }, 3000);
    };

    const startFirstLevel = () => {
        startWave(0);
    };

    const nextLevel = () => {
        if (currentLevel + 1 < levels.length) {
            startWave(currentLevel + 1);
        }
    };

    return {
        startFirstLevel,
        nextLevel,
        getCurrentLevel: () => currentLevel + 1,
        isWaveActive: () => isWaveActive,
        levels
    };
};
