import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createHealthBarUI } from './ui.js';

export const createHealthManager = async (scene, rocketship, shieldManager) => {
  let health = 100;
  const maxHealth = 100;
  const damageCooldown = 500; // ms voor zelfde asteroid damage te voorkomen
  const lastDamageTime = new Map();
  let onGameOverCallback = null;
  let isPaused = false;
  let isDead = false;

  const healthBarUI = createHealthBarUI(scene);

  //sound effect for asteroid collision
  const impactSound = await BABYLON.CreateSoundAsync("impact", "assets/sounds/ast-roc.mp3", {
    volume: 1,
    maxInstances: 3
  });

  const updateHealthBar = () => {
    //percentage berekenen van health
    const healthPercent = Math.max(0, health / maxHealth);
    healthBarUI.updateHealthBar(healthPercent);
  };

  const shakeCamera = (camera) => {
    if (camera.metadata && camera.metadata.isShaking) return;

    camera.metadata = { ...camera.metadata, isShaking: true };
    const originalPos = camera.position.clone();

    let elapsed = 0;
    const duration = 200;

    const observer = scene.onBeforeRenderObservable.add(() => {
      elapsed += scene.getEngine().getDeltaTime();
      if (elapsed < duration) {
        //cam schudden
        const intensity = 0.3 * (1 - elapsed / duration);
        camera.position.x = originalPos.x + (Math.random() - 0.5)* intensity;
        camera.position.y = originalPos.y + (Math.random() - 0.5)* intensity;
      } else {
        //schudden stoppen
        camera.position.copyFrom(originalPos);
        camera.metadata.isShaking = false;
        scene.onBeforeRenderObservable.remove(observer);
      }
    });
  };

  const showDamagePopup = (damageAmount) => {
    const textBlock = new GUI.TextBlock();
    textBlock.text = `-${damageAmount}`;
    textBlock.color = "#ff3333";
    textBlock.fontSize = 28;
    textBlock.fontFamily = "GameFont, Arial, sans-serif";
    textBlock.fontWeight = "bold";

    healthBarUI.guiTexture.addControl(textBlock);

    textBlock.linkWithMesh(rocketship);
    textBlock.linkOffsetY = -100;

    //animatie omhoog zweven
    let elapsed = 0;
    const duration = 1000;

    const observer = scene.onBeforeRenderObservable.add(() => {
      elapsed += scene.getEngine().getDeltaTime();
      const progress = elapsed / duration;

      textBlock.linkOffsetY = -100 - (progress * 80);
      textBlock.alpha = 1 - progress;

      if (progress >= 1) {
        healthBarUI.guiTexture.removeControl(textBlock);
        textBlock.dispose();
        scene.onBeforeRenderObservable.remove(observer);
      }
    });
  };

  const takeDamage = (damage, camera) => {
    if (shieldManager.isShieldActive() || isDead) {
      return;
    }

    health = Math.max(0, health - damage);
    updateHealthBar();
    shakeCamera(camera);
    showDamagePopup(damage);

    // Check game over
    if (health <= 0 && onGameOverCallback) {
      isDead = true;
      onGameOverCallback();
    }
  };

  // Botsing met Asteroïden
  const setupCollisionListener = (asteroidManager, camera) => {
    const onCollide = (collider, collidedAgainst) => {
      const asteroidMesh = collidedAgainst.object;
      const key = asteroidMesh.uniqueId;
      const now = Date.now();

      //cooldown om spam-damage van dezelfde steen te voorkomen
      if (!lastDamageTime.has(key) || now - lastDamageTime.get(key) > damageCooldown) {
        //damage berekenen op basis van grootte
        const damage = Math.ceil((asteroidMesh.scaling.x || 1) * 10);
        takeDamage(damage, camera);
        
        //play impact sound
        impactSound.play();

        lastDamageTime.set(key, now);
      }
    };

    //luister naar alle actieve asteroïden
    const observer = scene.onBeforeRenderObservable.add(() => {
      if (isPaused) return;
      const currentImpostor = rocketship.physicsImpostor;
      if (!currentImpostor) return;

      if (asteroidManager.active) {
        asteroidManager.active.forEach((asteroid) => {
          const hitbox = asteroid.metadata?.hitbox;
          if (!hitbox || !hitbox.physicsImpostor) return;

          // Check if registered against the CURRENT impostor
          if (hitbox.registeredImpostorId !== currentImpostor.uniqueId) {
            currentImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, onCollide);
            hitbox.registeredImpostorId = currentImpostor.uniqueId;
          }
        });
      }
    });
  };

  //botsing met projectielen (UFO kogels)
  const setupProjectileCollisionListener = (projectileManager, camera) => {
    const onProjectileCollide = (collider, collidedAgainst) => {
      const projMesh = collidedAgainst.object;

      //voorkomen dat 1 kogel meerdere keren damage doet in dezelfde frame
      if (projMesh.isEnabled() && !projMesh.isHit) {

        //verwijder kogel (zet isHit op true in manager)
        projectileManager.removeProjectile(projMesh);
        //doe schade (20hp per schot)
        takeDamage(20, camera);
      }
    };

    const observer = scene.onBeforeRenderObservable.add(() => {
      if (isPaused) return;
      const currentImpostor = rocketship.physicsImpostor;
      if (!currentImpostor) return;

      if (projectileManager.projectiles) {
        projectileManager.projectiles.forEach((proj) => {
          if (proj.active && proj.mesh.physicsImpostor) {
             //check if registered against the CURRENT impostor
            if (proj.registeredImpostorId !== currentImpostor.uniqueId) {
              currentImpostor.registerOnPhysicsCollide(proj.mesh.physicsImpostor, onProjectileCollide);
              proj.registeredImpostorId = currentImpostor.uniqueId;
            }
          }
        });
      }
    });
  };

  // Init bar
  updateHealthBar();

  return {
    takeDamage,
    setupCollisionListener,
    setupProjectileCollisionListener,
    getHealth: () => health,
    setHealth: (value) => {
      health = Math.max(0, Math.min(value, maxHealth));
      if (health > 0) isDead = false;
      updateHealthBar();
    },
    setPaused: (paused) => {
      isPaused = paused;
    },
    setOnGameOver: (callback) => {
      onGameOverCallback = callback;
    },
    dispose: () => {
      if (healthBarUI) healthBarUI.dispose();
    }
  };
}