import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';

const SHIELD_CONFIG = {
    scale: 0.7,
    spawnHeight: 15,
    spawnWidthRange: 10,
    fallSpeed: -4,
    rotationSpeed: 2,
    hitboxDiameter: 1,
    duration: 10000,
    despawnHeight: -5,
    color: {
        emissive: new BABYLON.Color3(0, 0.2, 0.5)
    },
    physics: {
        mass: 1,
        restitution: 0.5,
        friction: 0.3
    },
    popup: {
        text: 'SHIELD ACTIVE',
        color: '#00BFFF',
        fontSize: 28,
        yOffset: -50,
        duration: 1000
    },
    timer: {
        size: "80px",
        position: { top: '20px', right: '20px' }
    }
};

export const createShield = (scene, rocketship, camera, audioEngine) => {
    let powerup = null;
    let shieldModel = null;
    let isModelLoaded = false;
    let isShieldActive = false;

    let shieldTimerObserver = null;
    let timerContainer = null;
    let maskContainer = null;

    let updateObserver = null;
    let collisionCallback = null;
    let registeredImpostorId = null;
    let pickupSound = null;

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("shieldUI", true, scene);

    const loadSounds = async () => {
        try {
            pickupSound = await BABYLON.CreateSoundAsync("pickupSound", "assets/sounds/power-up_pickup.mp3", {
                loop: false,
                autoplay: false,
                volume: 0.7
            });
        } catch (e) {
            console.error("Failed to load shield pickup sound:", e);
        }
    };
    loadSounds();

    const handleCollision = async () => {
        if (powerup) {
            if (pickupSound) {
                if (audioEngine && audioEngine.audioContext?.state === 'suspended') {
                    audioEngine.audioContext.resume();
                }
                pickupSound.play();
            }

            activateShield();
            showShieldPopup();

            const powerupToRemove = powerup;
            powerup = null;

            //niet meerdere keren getriggerd kan worden
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionCallback && collisionMesh.physicsImpostor && powerupToRemove.physicsImpostor) {
                collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.physicsImpostor, collisionCallback);
            }
            collisionCallback = null;

            //veilig verwijderen
            scene.onAfterPhysicsObservable.addOnce(() => {
                const hitboxToDispose = powerupToRemove.metadata?.hitbox;
                if (hitboxToDispose) {
                    if (hitboxToDispose.physicsImpostor) hitboxToDispose.physicsImpostor.dispose();
                    hitboxToDispose.dispose();
                }
                powerupToRemove.dispose();
            });
        }
    };

    const loadShieldModel = async () => {
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "assets/blender-models/",
                "shieldpowerup3.glb",
                scene
            );

            //mesh zoeken en opslaan
            shieldModel = result.meshes[0];
            shieldModel.name = "shield_source";
            shieldModel.setEnabled(false);

            isModelLoaded = true;
        } catch (error) {
            console.error("Failed to load shield model:", error);
        }
    };

    loadShieldModel();
    const isSafeSpawnPosition = (x, asteroidSystem) => {
        if (!asteroidSystem?.manager?.active) return true;
        const minSafeDistance = 4;
        const minSafeDistanceX = 3;

        for (const asteroid of asteroidSystem.manager.active) {
            const asteroidX = asteroid.position.x;
            const asteroidY = asteroid.position.y;
            if (asteroidY > SHIELD_CONFIG.spawnHeight - 4 &&
                asteroidY < SHIELD_CONFIG.spawnHeight + 4) {
                const distance = Math.abs(asteroidX - x);
                if (distance < minSafeDistance) return false;
            }

            if (Math.abs(asteroidX - x) < minSafeDistanceX) return false;
        }
        return true;
    };

    const spawnPowerup = (asteroidSystem = null) => {
        if (!isModelLoaded) return;

        //instantiateHierarchy in plaats van clone + loop.
        //behoudt de parent-child structuur van het complexe shield model.
        const visualMesh = shieldModel.instantiateHierarchy();
        visualMesh.name = 'shield_visual';
        visualMesh.setEnabled(true);

        visualMesh.scaling.setAll(SHIELD_CONFIG.scale);
        visualMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        const hitbox = BABYLON.MeshBuilder.CreateSphere(
            "shieldHitbox",
            { diameter: SHIELD_CONFIG.hitboxDiameter },
            scene
        );
        hitbox.isVisible = false;

        let spawnX = 0;
        let attempts = 0;
        const maxAttempts = 10;
        do {
            spawnX = (Math.random() - 0.5) * SHIELD_CONFIG.spawnWidthRange;
            attempts++;
        } while (!isSafeSpawnPosition(spawnX, asteroidSystem) && attempts < maxAttempts);

        visualMesh.position.set(spawnX, SHIELD_CONFIG.spawnHeight, 0);
        hitbox.position.copyFrom(visualMesh.position);

        hitbox.physicsImpostor = new BABYLON.PhysicsImpostor(
            hitbox,
            BABYLON.PhysicsImpostor.SphereImpostor,
            SHIELD_CONFIG.physics,
            scene
        );

        hitbox.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, SHIELD_CONFIG.fallSpeed, 0));

        //koppel hitbox aan visual mesh
        visualMesh.physicsImpostor = hitbox.physicsImpostor;
        visualMesh.metadata = { hitbox: hitbox };

        powerup = visualMesh;

        //check voor hitbox van rocketship te krijgen, anders gewoon rocketship zelf gebruiken
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;

        if (collisionMesh.physicsImpostor) {
            registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
            collisionCallback = handleCollision;
            //registreer collision van rocketship met hitbox van powerup
            collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, collisionCallback);
        }
    };

    const activateShield = () => {
        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        if (!isShieldActive) {
            rocketship.metadata.toggleShield(true);
        }
        isShieldActive = true;
        let timeRemaining = SHIELD_CONFIG.duration / 1000;
        const totalDuration = SHIELD_CONFIG.duration / 1000;

        createShieldTimerUI();

        //babylon timer loop
        shieldTimerObserver = scene.onBeforeRenderObservable.add(() => {
            //berekenen tijd via engine delta time (soepeler)
            const dt = scene.getEngine().getDeltaTime() / 1000;
            timeRemaining -= dt;

            if (maskContainer) {
                //calculate percentage (0 to 1)
                //add a small visual buffer (10%) so the bar doesn't look empty 
                //while the shield is still active (due to image padding/transparency)
                const rawPercentage = Math.max(0, timeRemaining / totalDuration);
                const visualBuffer = 0.1; 
                const percentage = rawPercentage * (1 - visualBuffer) + visualBuffer;
                
                maskContainer.height = `${percentage * 100}%`;
            }
            
            if (timeRemaining <= 0) {
                deactivateShield();
            }
        });
    };

    const deactivateShield = () => {
        if (isShieldActive) {
            rocketship.metadata.toggleShield(false);
        }
        isShieldActive = false;

        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        //verwijder UI
        if (timerContainer) {
            guiTexture.removeControl(timerContainer);
            timerContainer.dispose();
            timerContainer = null;
            maskContainer = null;
        }
    };

    const createShieldTimerUI = () => {
        //oude opruimen voor de zekerheid
        if (timerContainer) {
            guiTexture.removeControl(timerContainer);
            timerContainer.dispose();
        }

        const startSize = 200;
        const targetSize = parseInt(SHIELD_CONFIG.timer.size); // 80

        //start at center
        timerContainer = new GUI.Container("shieldTimerContainer");
        timerContainer.width = `${startSize}px`;
        timerContainer.height = `${startSize}px`;
        timerContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        timerContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        timerContainer.top = "0px";
        timerContainer.left = "0px";
        guiTexture.addControl(timerContainer);

        //(faded/empty version)
        const bgImage = new GUI.Image("shieldBg", "assets/images/shield.png");
        bgImage.width = "100%";
        bgImage.height = "100%";
        bgImage.alpha = 0.3; 
        timerContainer.addControl(bgImage);

        //mask Container for the "Active" part
        maskContainer = new GUI.Container("shieldMask");
        maskContainer.width = "100%";
        maskContainer.height = "100%"; 
        maskContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        maskContainer.clipChildren = true;
        timerContainer.addControl(maskContainer);

        //foreground (Active) Shield
        const fgImage = new GUI.Image("shieldFg", "assets/images/shield.png");
        fgImage.width = `${startSize}px`; 
        fgImage.height = `${startSize}px`;
        fgImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        maskContainer.addControl(fgImage);

        //animation to move to top-right
        const animateMove = () => {
            if (!timerContainer) return;

            const engine = scene.getEngine();
            const width = engine.getRenderWidth();
            const height = engine.getRenderHeight();
            
            //calculate target position (Top-Right) relative to Center
            //center (0,0). Top-Right is (+width/2, -height/2)
            //we want 20px margin.
            const margin = 20;
            const targetLeft = (width / 2) - margin - (targetSize / 2);
            const targetTop = -(height / 2) + margin + (targetSize / 2);

            const duration = 800;
            const fps = 60;
            const totalFrames = (duration / 1000) * fps;
            
            let frame = 0;
            const observer = scene.onBeforeRenderObservable.add(() => {
                if (!timerContainer) {
                    scene.onBeforeRenderObservable.remove(observer);
                    return;
                }

                frame++;
                const progress = Math.min(frame / totalFrames, 1);
                const ease = progress * progress * (3 - 2 * progress); // Smoothstep

                const currentSize = startSize + (targetSize - startSize) * ease;
                const currentLeft = 0 + (targetLeft - 0) * ease;
                const currentTop = 0 + (targetTop - 0) * ease;

                timerContainer.width = `${currentSize}px`;
                timerContainer.height = `${currentSize}px`;
                timerContainer.left = `${currentLeft}px`;
                timerContainer.top = `${currentTop}px`;
                
                //update inner image size to match container (prevent squashing/clipping issues)
                fgImage.width = `${currentSize}px`;
                fgImage.height = `${currentSize}px`;

                if (progress >= 1) {
                    scene.onBeforeRenderObservable.remove(observer);
                }
            });
        };
        setTimeout(animateMove, 400);
    };

    const showShieldPopup = () => {
        const textBlock = new GUI.TextBlock();
        textBlock.text = SHIELD_CONFIG.popup.text;
        textBlock.color = SHIELD_CONFIG.popup.color;
        textBlock.fontSize = SHIELD_CONFIG.popup.fontSize;
        textBlock.fontWeight = "bold";
        textBlock.fontFamily = "GameFont, Arial, sans-serif";
        textBlock.outlineWidth = 2;
        textBlock.outlineColor = "black";

        guiTexture.addControl(textBlock);

        textBlock.linkWithMesh(rocketship);
        textBlock.linkOffsetY = SHIELD_CONFIG.popup.yOffset;

        let alpha = 1.0;
        let offset = SHIELD_CONFIG.popup.yOffset;

        const observer = scene.onBeforeRenderObservable.add(() => {
            offset -= 2;
            alpha -= 0.02;

            textBlock.linkOffsetY = offset;
            textBlock.alpha = alpha;

            if (alpha <= 0) {
                guiTexture.removeControl(textBlock);
                textBlock.dispose();
                scene.onBeforeRenderObservable.remove(observer);
            }
        });
    };

    //reset functie voor level restarts
    const reset = () => {
        //stop de babylon timer observer
        if (shieldTimerObserver) {
            scene.onBeforeRenderObservable.remove(shieldTimerObserver);
            shieldTimerObserver = null;
        }

        if (timerContainer) {
            guiTexture.removeControl(timerContainer);
            timerContainer.dispose();
            timerContainer = null;
            maskContainer = null;
        }

        deactivateShield();

        if (powerup) {
            const powerupToRemove = powerup;
            powerup = null;

            //stop de engine voor collisions te watchen
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionCallback && powerupToRemove.physicsImpostor) {
                collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.physicsImpostor, collisionCallback);
            }
            collisionCallback = null;

            //veilig verwijderen
            scene.onAfterPhysicsObservable.addOnce(() => {
                const hitboxToDispose = powerupToRemove.metadata?.hitbox;
                if (hitboxToDispose) {
                    if (hitboxToDispose.physicsImpostor) hitboxToDispose.physicsImpostor.dispose();
                    hitboxToDispose.dispose();
                }
                powerupToRemove.dispose();
            });
        }
    };

    if (updateObserver) {
        scene.onBeforeRenderObservable.remove(updateObserver);
    }

    updateObserver = scene.onBeforeRenderObservable.add(() => {
        if (powerup) {
            const hitbox = powerup.metadata?.hitbox;

            //check for dynamic hitbox changes
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionMesh.physicsImpostor && collisionMesh.physicsImpostor.uniqueId !== registeredImpostorId) {
                 registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
                 collisionCallback = handleCollision;
                 collisionMesh.physicsImpostor.registerOnPhysicsCollide(hitbox.physicsImpostor, collisionCallback);
            }

            if (hitbox) {
                //synchroniseer positie
                powerup.position.copyFrom(hitbox.position);
                powerup.rotation.z += 0.03;

                //despawn als hij te laag komt
                if (hitbox.position.y < SHIELD_CONFIG.despawnHeight) {
                    reset();
                }
            }

        }
    });

    const cleanup = () => {
        reset();
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
            updateObserver = null;
        }
        if (guiTexture) {
            guiTexture.dispose();
        }
    };

    return {
        spawnPowerup,
        isShieldActive: () => isShieldActive,
        reset,
        cleanup
    };
}