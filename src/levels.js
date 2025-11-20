export const createLevelManager = (asteroidSystem, ufo) => {
    let currentLevel = 0;
    let isWaveActive = false;
    let waveTimer = null;

    const levels = [
        {
            level: 1,
            duration: 10000,
            asteroidSpeed: { min: 3, max: 6 },
            spawnRate: 1
        },
        {
            level: 2,
            duration: 15000,
            asteroidSpeed: { min: 5, max: 10 },
            spawnRate: 1.5
        },
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
            ufo.flyUFO(() => {
                setTimeout(() => {
                    if (currentLevel + 1 < levels.length) {
                        startWave(currentLevel + 1);
                    }
                }, 3000);
            });
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
