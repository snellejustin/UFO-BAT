export class ScoreManager {
    constructor() {
        this.score = 0;
        this.scoreElement = null;
        this.initUI();
    }

    initUI() {
        const scoreContainer = document.createElement('div');
        scoreContainer.id = 'score-container';
        scoreContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 999;
            font-family: 'Arial', sans-serif;
            pointer-events: none;
        `;

        this.scoreElement = document.createElement('div');
        this.scoreElement.id = 'score-display';
        this.scoreElement.textContent = 'SCORE: 0';
        this.scoreElement.style.cssText = `
            font-size: 32px;
            font-weight: bold;
            color: #00ff00;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
            letter-spacing: 2px;
        `;

        scoreContainer.appendChild(this.scoreElement);
        document.body.appendChild(scoreContainer);
    }

    addScore(points) {
        this.score += points;
        this.updateDisplay();
    }

    setScore(value) {
        this.score = Math.max(0, value);
        this.updateDisplay();
    }

    getScore() {
        return this.score;
    }

    updateDisplay() {
        if (this.scoreElement) {
            this.scoreElement.textContent = `SCORE: ${this.score}`;
        }
    }

    reset() {
        this.score = 0;
        this.updateDisplay();
    }
}

export const createScoreManager = () => {
    return new ScoreManager();
};
