# UFO-BAT 🚀👽

A 3D space shooter game built with Babylon.js for a bachelor thesis project at Devine (2025-2026). Control a rocketship, dodge asteroids, battle UFOs, and collect powerups across multiple challenging levels to save your cow!

## 🎮 About the Game

UFO-BAT (UFO Abduction) is an interactive space combat game where you pilot a rocketship through waves of asteroids while battling alien UFOs. The game features:

- **Multiple Levels**: Progressive difficulty with 5 levels, each with unique UFO enemies
- **Dynamic Combat**: Face different UFO types with varying attack patterns and projectiles
- **Power-ups**:  Collect health boosts, shields, and a rocket shooter to enhance your abilities
- **Physics-Based Gameplay**: Realistic collision detection using Cannon.js physics engine
- **Bluetooth Controller Support**: WitMotion sensor integration for tilt-based controls
- **Immersive Audio**: Background music, sound effects, and atmospheric wind sounds
- **Beautiful Visuals**: Custom skybox, glow effects, and particle systems

## 🛠️ Tech Stack

- **Game Engine**: [Babylon.js](https://www.babylonjs.com/) v8.36+
- **Physics**: [Cannon-es](https://pmndrs.github.io/cannon-es/) v0.20. 0
- **Build Tool**: [Vite](https://vitejs.dev/) v7.2.2
- **3D Models**: Custom GLB models
- **UI**:  Babylon.js GUI system

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 16 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, or Safari)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/snellejustin/UFO-BAT.git
cd UFO-BAT
```

### 2. Install Dependencies

Install all required npm packages:

```bash
npm install
```

This will install:
- `@babylonjs/core` - Core Babylon.js engine
- `@babylonjs/GUI` - GUI elements
- `@babylonjs/loaders` - Loader
- `@babylonjs/inspector` - Debugging tools for Babylon.js
- `@babylonjs/procedural-textures` - Procedural texture generation
- `cannon-es` - Physics engine
- `vite` - Development server and build tool

### 3. Run the Development Server

Start the local development server:

```bash
npm run dev
```

The game will be available at `http://localhost:5173` (or another port if 5173 is in use). Vite will display the exact URL in your terminal.

## 🎯 How to Play

### Keyboard Controls (not recommended for game)
- **Arrow Keys**: Move your rocketship (Left/Right)

### Bluetooth Controller
The game supports WitMotion sensors for tilt-based controls via Bluetooth. Click the dot button in the top left corner in the game to pair your device.

### Gameplay
1. Shake gyroscope (witmotion controller) to start
2. Survive all waves of asteroids by dodging them
3. Watch out for UFO enemies that shoot projectiles at you
4. Collect powerups to boost your health, activate shields, or gain shooting abilities
5. Complete all levels to see the victory sequence

## 🎨 Key Features

### Level System
- **Level 1**: easy
- **Level 2**: beginner
- **Level 3**: medium
- **Level 4**: advanced
- **Level 5**: hard --> save cow

### Power-ups
- **Health Boost**: Restore health points
- **Shield**: Temporary invincibility
- **Rocket Shooter**: Gain the ability to shoot at enemies

### Visual Effects
- Dynamic skybox with dual rotating layers for parallax effect
- Glow effects on projectiles and UI elements
- Camera shake on damage
- Smooth fade transitions between game states

## 🐛 Troubleshooting

### Game doesn't load
- Check browser console for errors
- Ensure all assets are properly placed in the `assets` folder
- Try clearing browser cache and reloading

### Physics behaving strangely
- The game uses Cannon.js physics - ensure no conflicting physics libraries are loaded
- Check that `cannon-es` is properly installed

### Bluetooth sensor won't connect
- Bluetooth Web API is only available in secure contexts (HTTPS or localhost)
- Ensure your WitMotion sensor is powered on and in pairing mode
- Only supported in browsers with Web Bluetooth API (Chrome, Edge)
- Check UUID of witmotion controller and update in the witmotion.js if needed

## 🎓 Academic Context

This project is part of a bachelor thesis for Devine 2025-2026, tracking different versions of the UFO ABDUCTION game concept. 

**Note**: Make sure all asset files (models, sounds, images, videos) are properly placed in the `assets` directory before running the game. 
