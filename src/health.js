import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export function createHealthManager(scene, rocketship, shieldManager) {
  let health = 100;
  const maxHealth = 100;
  const damageCooldown = 500; // ms
  const lastDamageTime = new Map();

  const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("HealthUI", true, scene);

  const healthBarContainer = new GUI.Rectangle("healthBarContainer");
  healthBarContainer.width = "120px";
  healthBarContainer.height = "14px";
  healthBarContainer.cornerRadius = 2;
  healthBarContainer.color = "black"; // Border color
  healthBarContainer.thickness = 1;
  healthBarContainer.background = "#404040"; // Dark Grey Background

  guiTexture.addControl(healthBarContainer);

  //zweven bij rocket
  healthBarContainer.linkWithMesh(rocketship);
  healthBarContainer.linkOffsetY = -80; 

  const healthBarInner = new GUI.Rectangle("healthBarInner");
  healthBarInner.width = 1;
  healthBarInner.height = "100%";
  healthBarInner.cornerRadius = 2;
  healthBarInner.thickness = 0;
  healthBarInner.background = "#00ff00";
  healthBarInner.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  healthBarContainer.addControl(healthBarInner);

  const updateHealthBar = () => {
    const healthPercent = Math.max(0, health / maxHealth);
    healthBarInner.width = healthPercent; //GUI supports float (0.0 to 1.0) for percentage

    if (healthPercent > 0.6) healthBarInner.background = "#00ff00"; 
    else if (healthPercent > 0.3) healthBarInner.background = "#ffff00"; 
    else healthBarInner.background = "#ff0000";
  };

  const flashRocketship = () => {
    if (!rocketship.material) return;

    const oldColor = rocketship.material.emissiveColor ? rocketship.material.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);

    if (!rocketship.material.emissiveColor) rocketship.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    rocketship.material.emissiveColor.set(1, 0, 0);

    setTimeout(() => {
      if (rocketship.material) {
        rocketship.material.emissiveColor.copyFrom(oldColor);
      }
    }, 100);
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
        const intensity = 0.3 * (1 - elapsed / duration);
        camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
        camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity;
      } else {
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

    textBlock.outlineWidth = 3;
    textBlock.outlineColor = "black";

    guiTexture.addControl(textBlock);

    textBlock.linkWithMesh(rocketship);
    textBlock.linkOffsetY = -100;

    //animate floating up text
    let elapsed = 0;
    const duration = 1000;

    const observer = scene.onBeforeRenderObservable.add(() => {
      elapsed += scene.getEngine().getDeltaTime();
      const progress = elapsed / duration;

      textBlock.linkOffsetY = -100 - (progress * 80);
      textBlock.alpha = 1 - progress;

      if (progress >= 1) {
        guiTexture.removeControl(textBlock);
        textBlock.dispose();
        scene.onBeforeRenderObservable.remove(observer);
      }
    });
  };

  const takeDamage = (damage, camera) => {
    if (shieldManager && shieldManager.isShieldActive()) {
      return;
    }

    health = Math.max(0, health - damage);
    updateHealthBar();
    flashRocketship();
    if (camera) shakeCamera(camera);
    showDamagePopup(damage);
  };

  const setupCollisionListener = (asteroidManager, camera) => {
    const impostor = rocketship.physicsImpostor;
    if (!impostor) return;

    const onCollide = (collider, collidedAgainst) => {
      const asteroidMesh = collidedAgainst.object;
      const key = asteroidMesh.uniqueId;
      const now = Date.now();

      if (!lastDamageTime.has(key) || now - lastDamageTime.get(key) > damageCooldown) {
        const damage = Math.ceil((asteroidMesh.scaling.x || 1) * 10);
        takeDamage(damage, camera);
        lastDamageTime.set(key, now);
      }
    };

    const observer = scene.onBeforeRenderObservable.add(() => {
      //enkel active asteroids checken
      if (asteroidManager.active) {
        asteroidManager.active.forEach((asteroid) => {
          const hitbox = asteroid.metadata?.hitbox;
          if (!hitbox || !hitbox.physicsImpostor) return;

          if (!hitbox._collisionRegistered) {
            hitbox._collisionRegistered = true;
            impostor.registerOnPhysicsCollide(hitbox.physicsImpostor, onCollide);
          }
        });
      }
    });
  };

  const setupProjectileCollisionListener = (projectileManager, camera) => {
    const impostor = rocketship.physicsImpostor;
    if (!impostor) return;

    const onProjectileCollide = (collider, collidedAgainst) => {
      const projMesh = collidedAgainst.object;
      //enkel bullet die actief is
      if (projMesh.isEnabled()) {
        takeDamage(30, camera);
        projectileManager.removeProjectile(projMesh);
      }
    };

    const observer = scene.onBeforeRenderObservable.add(() => {
      if (projectileManager.projectiles) {
        projectileManager.projectiles.forEach((proj) => {
          //enkel bullet die actief is
          if (proj.active && proj.mesh.physicsImpostor) {
            if (!proj._collisionRegistered) {
              proj._collisionRegistered = true;
              impostor.registerOnPhysicsCollide(proj.mesh.physicsImpostor, onProjectileCollide);
            }
          }
        });
      }
    });
  };
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
    dispose: () => {
      if (guiTexture) guiTexture.dispose();
    }
  };
}