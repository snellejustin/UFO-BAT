export const createCountdown = () => {
    const countdownOverlay = document.createElement('div');
    countdownOverlay.id = 'countdown-overlay';
    countdownOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: none;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        z-index: 2000;
    `;
    document.body.appendChild(countdownOverlay);

    const countdownNumber = document.createElement('div');
    countdownNumber.id = 'countdown-number';
    countdownNumber.style.cssText = `
        font-size: 120px;
        font-weight: bold;
        color: #00ff00;
        text-shadow: 0 0 40px rgba(0, 255, 0, 1);
        font-family: 'Arial', sans-serif;
    `;
    countdownOverlay.appendChild(countdownNumber);

    /**
     * @param {Function} onComplete
     */
    const startCountdown = (onComplete) => {
        let count = 3;
        countdownOverlay.style.display = 'flex';
        countdownNumber.textContent = count;

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
            } else {
                clearInterval(countdownInterval);
                countdownOverlay.style.display = 'none';
                if (onComplete) {
                    onComplete();
                }
            }
        }, 1000);
    };

    return {
        startCountdown
    };
};
