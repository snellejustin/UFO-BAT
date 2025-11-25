import { connectToWitMotion } from './witmotion.js';

export const createPlayButton = (countdown, levelManager) => {
    const gameState = {
        isPlaying: false,
    };

    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    uiContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        z-index: 1000;
    `;
    document.body.appendChild(uiContainer);

    const playButton = document.createElement('button');
    playButton.textContent = 'PLAY';
    playButton.id = 'play-button';
    playButton.style.cssText = `
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background-color: #00ff00;
        color: #000;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.7);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
    `;


    playButton.addEventListener('mouseover', () => {
        playButton.style.backgroundColor = '#00ff00';
        playButton.style.transform = 'scale(1.1)';
        playButton.style.boxShadow = '0 0 40px rgba(0, 255, 0, 1)';
    });

    playButton.addEventListener('mouseout', () => {
        playButton.style.backgroundColor = '#00ff00';
        playButton.style.transform = 'scale(1)';
        playButton.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.7)';
    });

    playButton.addEventListener('click', async () => {
        
        await connectToWitMotion();
        uiContainer.style.display = 'none';

        countdown.startCountdown(() => {
            gameState.isPlaying = true;
            levelManager.startFirstLevel();
        });
    });

    uiContainer.appendChild(playButton);

    return gameState;
};
