import { connectToWitMotion } from './witmotion.js';
import * as GUI from '@babylonjs/gui';

export const createHealthBarUI = (scene) => {
    // AdvancedDynamicTexture aanmaken (Fullscreen)
    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("HealthUI", true, scene);

    // 1. Rudy Character Image
    const rudyImage = new GUI.Image("rudyImage", "assets/images/UIexportRudy.png");
    rudyImage.width = "240px";
    rudyImage.height = "180px";
    rudyImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    rudyImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rudyImage.left = "40px";
    rudyImage.top = "-30px";
    guiTexture.addControl(rudyImage);

    // 2. Health Bar Background (Lege bar image)
    const healthBarBgImage = new GUI.Image("healthBarBg", "assets/images/UIexportHealthbar.png");
    healthBarBgImage.width = "250px";
    healthBarBgImage.height = "60px";
    healthBarBgImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBarBgImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    healthBarBgImage.left = "220px";
    healthBarBgImage.top = "-40px";
    guiTexture.addControl(healthBarBgImage);

    // 3. Container voor de 'Fill' (De groene balk zelf)
    const healthBarContainer = new GUI.Rectangle("healthBarContainer");
    healthBarContainer.width = "170px"; // Breedte van het 'vulbare' gedeelte in je plaatje
    healthBarContainer.height = "20px"; // Hoogte van het vulbare gedeelte
    healthBarContainer.cornerRadius = 4;
    healthBarContainer.color = "transparent";
    healthBarContainer.thickness = 0;
    healthBarContainer.background = "transparent";

    // Positionering (moet precies over het lege gedeelte van je achtergrondplaatje vallen)
    healthBarContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBarContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    healthBarContainer.left = "290px";
    healthBarContainer.top = "-60px";

    guiTexture.addControl(healthBarContainer);

    // 4. De Inner Bar (Het bewegende deel)
    const healthBarInner = new GUI.Rectangle("healthBarInner");
    healthBarInner.width = "100%"; // Start vol (100% als string!)
    healthBarInner.height = "100%";
    healthBarInner.cornerRadius = 2;
    healthBarInner.thickness = 0;
    healthBarInner.background = "#00ff00";
    healthBarInner.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Zorg dat hij links uitlijnt zodat hij naar rechts krimpt

    healthBarContainer.addControl(healthBarInner);

    return {
        guiTexture,
        healthBarInner,
        updateHealthBar: (healthPercent) => {
            // FIX: Babylon GUI verwacht strings voor percentages (bijv "50%")
            // healthPercent is 0.0 tot 1.0
            const percent = Math.max(0, Math.min(1, healthPercent)) * 100;
            healthBarInner.width = `${percent}%`;

            // Kleur logic
            if (healthPercent > 0.6) healthBarInner.background = "#00ff00";
            else if (healthPercent > 0.3) healthBarInner.background = "#ffff00";
            else healthBarInner.background = "#ff0000";
        },
        dispose: () => {
            if (guiTexture) guiTexture.dispose();
        }
    };
};

export const createPlayButton = (countdown, levelManager) => {
    const gameState = {
        isPlaying: false,
    };

    // HTML Overlay Container
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
        pointer-events: none; /* Kliks gaan erdoorheen waar geen knop zit */
        z-index: 1000;
    `;
    document.body.appendChild(uiContainer);

    // De Knop
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
        pointer-events: auto; /* Zorg dat de knop wel klikbaar is */
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
        // Probeer sensors te verbinden
        try {
            await connectToWitMotion();
        } catch (e) {
            console.warn("Witmotion connection cancelled or failed", e);
            // We gaan door, ook als sensor faalt (fallback naar keyboard)
        }

        // Verberg UI
        uiContainer.style.display = 'none';

        // Start countdown -> start game
        countdown.startCountdown(() => {
            gameState.isPlaying = true;
            levelManager.startFirstLevel();
        });
    });

    uiContainer.appendChild(playButton);

    return gameState;
};