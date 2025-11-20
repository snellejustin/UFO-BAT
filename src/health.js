import * as BABYLON from '@babylonjs/core';

export function createHealthManager(scene, rocketship, shieldManager) {
  let health = 100;
  const maxHealth = 100;
  let lastDamageTime = {};
  const damageCooldown = 500;

  const barWidth = 1.5;
  const yPosition = 1.2;

  const bgPoints = [
    new BABYLON.Vector3(-barWidth / 2, yPosition, 0),
    new BABYLON.Vector3(barWidth / 2, yPosition, 0)
  ];
  const bgLine = BABYLON.MeshBuilder.CreateLines('healthBarBg', { points: bgPoints }, scene);
  bgLine.color = new BABYLON.Color3(0.3, 0.3, 0.3);
  bgLine.parent = rocketship;
  bgLine.renderingGroupId = 1;

  let healthLine = null;

  function updateHealthBar() {
    if (healthLine) {
      healthLine.dispose();
    }

    let barColor;
    const healthPercent = (health / maxHealth) * 100;
    if (healthPercent > 66) barColor = new BABYLON.Color3(0, 1, 0);
    else if (healthPercent > 33) barColor = new BABYLON.Color3(1, 1, 0);
    else barColor = new BABYLON.Color3(1, 0, 0);

    const healthWidth = (health / maxHealth) * barWidth;
    const healthPoints = [
      new BABYLON.Vector3(-barWidth / 2, yPosition, 0),
      new BABYLON.Vector3(-barWidth / 2 + healthWidth, yPosition, 0)
    ];
    healthLine = BABYLON.MeshBuilder.CreateLines('healthBar', { points: healthPoints }, scene);
    healthLine.color = barColor;
    healthLine.parent = rocketship;
    healthLine.renderingGroupId = 1;
  }

  function flashRocketship() {
    if (!rocketship.material) {
      rocketship.material = new BABYLON.StandardMaterial('rocketshipMaterial', scene);
      rocketship.material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      rocketship.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    }
    
    const originalColor = rocketship.material.emissiveColor.clone();
    rocketship.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
    setTimeout(() => {
      rocketship.material.emissiveColor = originalColor;
    }, 100);
  }

  function shakeCamera(camera) {
    const originalPosition = camera.position.clone();
    const shakeIntensity = 0.3;
    const shakeDuration = 150;
    const shakeFrequency = 10;

    let elapsed = 0;
    const shakeInterval = setInterval(() => {
      elapsed += shakeFrequency;
      const randomX = (Math.random() - 0.5) * shakeIntensity;
      const randomY = (Math.random() - 0.5) * shakeIntensity;

      camera.position.x = originalPosition.x + randomX;
      camera.position.y = originalPosition.y + randomY;

      if (elapsed >= shakeDuration) {
        clearInterval(shakeInterval);
        camera.position = originalPosition;
      }
    }, shakeFrequency);
  }

  function showDamagePopup(damageAmount, camera) {
    const healthBarWorldPos = new BABYLON.Vector3(
      rocketship.position.x,
      rocketship.position.y + 1.2,
      rocketship.position.z
    );
    
    const engine = scene.getEngine();
    const screenPos = BABYLON.Vector3.Project(
      healthBarWorldPos,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    );

    const popup = document.createElement('div');
    popup.textContent = `- ${damageAmount}`;
    popup.style.cssText = `
      position: fixed;
      left: ${screenPos.x}px;
      top: ${screenPos.y - 30}px;
      transform: translate(-50%, -100%);
      font-size: 32px;
      font-weight: bold;
      color: #FF0000;
      text-shadow: 0 0 10px #FF0000, 0 0 20px #FF0000;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(popup);

    let yOffset = 0;
    const animationInterval = setInterval(() => {
      yOffset += 2;
      popup.style.top = `${screenPos.y - 30 - yOffset}px`;
      popup.style.opacity = `${1 - yOffset / 60}`;
    }, 16);

    setTimeout(() => {
      clearInterval(animationInterval);
      popup.remove();
    }, 1000);
  }

  function playDamageEffect(camera, damageAmount) {
    flashRocketship();
    shakeCamera(camera);
    showDamagePopup(damageAmount, camera);
    updateHealthBar();
  }

  function takeDamage(damage, camera) {
    if (shieldManager && shieldManager.isShieldActive()) {
      return;
    }
    health = Math.max(0, health - damage);
    playDamageEffect(camera, damage);
  }

  function setupCollisionListener(asteroidManager, camera) {
    const impostor = rocketship.physicsImpostor;
    
    if (!impostor) {
      return;
    }

    scene.registerBeforeRender(() => {
      asteroidManager.active.forEach((asteroid) => {
        if (!asteroid.physicsImpostor) return;
        
        if (!asteroid._collisionRegistered) {
          asteroid._collisionRegistered = true;
          
          impostor.registerOnPhysicsCollide(asteroid.physicsImpostor, () => {
            const key = asteroid.uniqueId;
            const now = Date.now();

            if (!lastDamageTime[key] || now - lastDamageTime[key] > damageCooldown) {
              const damage = Math.ceil(asteroid.scaling.x * 10);
              takeDamage(damage, camera);
              lastDamageTime[key] = now;
            }
          });
        }
      });
    });
  }

  function setupProjectileCollisionListener(projectileManager, camera) {
    const impostor = rocketship.physicsImpostor;
    
    if (!impostor) {
      return;
    }

    scene.registerBeforeRender(() => {
      projectileManager.projectiles.forEach((proj) => {
        if (!proj.active || !proj.mesh.physicsImpostor) return;

        if (!proj._collisionRegistered) {
          proj._collisionRegistered = true;
          
          impostor.registerOnPhysicsCollide(proj.mesh.physicsImpostor, () => {
            if (proj.active) {
              takeDamage(30, camera);
              projectileManager.removeProjectile(proj.mesh);
            }
          });
        }
      });
    });
  }

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
  };
}
