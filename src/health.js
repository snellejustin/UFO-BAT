import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createHealthBarUI } from './ui.js';

export const createHealthManager = (scene, rocketship, shieldManager) => {
  let health = 100;
  const maxHealth = 100;
  const damageCooldown = 500; // ms voor zelfde asteroid damage te voorkomen
  const lastDamageTime = new Map();
  let onGameOverCallback = null;

  const healthBarUI = createHealthBarUI(scene);

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
    if (shieldManager.isShieldActive()) {
      return;
    }

    health = Math.max(0, health - damage);
    updateHealthBar();
    shakeCamera(camera);
    showDamagePopup(damage);

    // Check game over
    if (health <= 0 && onGameOverCallback) {
      onGameOverCallback();
    }
  };

  // Botsing met Asteroïden
  const setupCollisionListener = (asteroidManager, camera) => {
    //rocketship als collider
    const impostor = rocketship.physicsImpostor;
    if (!impostor) return;

    const onCollide = (collider, collidedAgainst) => {
      const asteroidMesh = collidedAgainst.object;
      const key = asteroidMesh.uniqueId;
      const now = Date.now();

      //cooldown om spam-damage van dezelfde steen te voorkomen
      if (!lastDamageTime.has(key) || now - lastDamageTime.get(key) > damageCooldown) {
        //damage berekenen op basis van grootte
        const damage = Math.ceil((asteroidMesh.scaling.x || 1) * 10);
        takeDamage(damage, camera);
        lastDamageTime.set(key, now);
      }
    };

    //luister naar alle actieve asteroïden
    const observer = scene.onBeforeRenderObservable.add(() => {
      if (asteroidManager.active) {
        asteroidManager.active.forEach((asteroid) => {
          const hitbox = asteroid.metadata?.hitbox;
          if (!hitbox || !hitbox.physicsImpostor) return;

          if (!hitbox.collisionRegistered) {
            hitbox.collisionRegistered = true;
            impostor.registerOnPhysicsCollide(hitbox.physicsImpostor, onCollide);
          }
        });
      }
    });
  };

  //botsing met projectielen (UFO kogels)
  const setupProjectileCollisionListener = (projectileManager, camera) => {
    //rocketship als collider
    const impostor = rocketship.physicsImpostor;
    if (!impostor) return;

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
      if (projectileManager.projectiles) {
        projectileManager.projectiles.forEach((proj) => {
          if (proj.active && proj.mesh.physicsImpostor) {
            if (!proj.collisionRegistered) {
              proj.collisionRegistered = true;
              impostor.registerOnPhysicsCollide(proj.mesh.physicsImpostor, onProjectileCollide);
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
      updateHealthBar();
    },
    setOnGameOver: (callback) => {
      onGameOverCallback = callback;
    },
    dispose: () => {
      if (healthBarUI) healthBarUI.dispose();
    }
  };
}