import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';

const CONFIG = {
    spawnHeight: 15,
    hoverHeight: 2,
    fallSpeed: -4,
    fireRate: 1.0,
    projectileSpeed: 10,
    colGroup: 4,      
    colMask: 1,         
};

export const createRocketShooter = (scene, rocketship, camera, projectileManager) => {

    let activePowerup = null;
    let isShooting = false;
    let shootTimer = 0;
    let collisionCallback = null;
    let registeredImpostorId = null;
    let currentOnCollected = null;

    let uiTexture = null;
    let updateObserver = null;

    const setupGUI = () => {
        if (!uiTexture) uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("RocketShooterUI", true, scene);
    };

    const showPopup = () => {
        setupGUI();
        const text = new GUI.TextBlock();
        text.text = "AUTO-CANNON!";
        text.color = "#FF0000";
        text.fontSize = 28;
        text.fontFamily = "GameFont, Arial, sans-serif";
        text.fontWeight = "bold";
        text.outlineWidth = 2;
        text.outlineColor = "black";

        uiTexture.addControl(text);

        text.linkWithMesh(rocketship);
        text.linkOffsetY = -100;

        let alpha = 1.0;
        let offset = -100;

        const animObserver = scene.onBeforeRenderObservable.add(() => {
            offset -= 2;    
            alpha -= 0.015;

            text.linkOffsetY = offset;
            text.alpha = alpha;

            if (alpha <= 0) {
                scene.onBeforeRenderObservable.remove(animObserver);
                uiTexture.removeControl(text);
                text.dispose();
            }
        });
    };

    const spawnPowerup = async (onCollected) => {
        if (activePowerup) return;

        // Create invisible hitbox for physics
        const mesh = BABYLON.MeshBuilder.CreateSphere('rocketShooterHitbox', { diameter: 0.8 }, scene);
        mesh.position.set(0, CONFIG.spawnHeight, 0);
        mesh.isVisible = false;

        // Load GLB model
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/blender-models/", "shooterpowerup.glb", scene);
            const model = result.meshes[0];
            model.parent = mesh;
            model.position.setAll(0);
            model.scaling.setAll(0.7); 

            // Add rotation animation
            const rotationObserver = scene.onBeforeRenderObservable.add(() => {
                if (model && !model.isDisposed()) {
                    model.rotation.y += 0.02;
                } else {
                    scene.onBeforeRenderObservable.remove(rotationObserver);
                }
            });
        } catch (e) {
            console.error("Failed to load shooterpowerup.glb", e);
            // Fallback to visible sphere
            mesh.isVisible = true;
            const mat = new BABYLON.StandardMaterial('rocketShooterMat', scene);
            mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
            mat.disableLighting = true;
            mesh.material = mat;
        }

        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            mesh,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { mass: 1, restitution: 0, friction: 0 }, 
            scene
        );

        const body = mesh.physicsImpostor.physicsBody;
        if (body) {
            body.collisionFilterGroup = CONFIG.colGroup;  //group 4
            body.collisionFilterMask = CONFIG.colMask;    //botst alleen met group 1 (rocketship)
            body.collisionResponse = 0;  //geen fysieke reactie op botsingen (ghost mode)
            body.fixedRotation = true;   //voorkom rotatie
            body.updateMassProperties();
        }

        mesh.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, CONFIG.fallSpeed, 0));
        activePowerup = mesh;

        //collision met rocketship hitbox en anders met rockethship zelf
        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
        currentOnCollected = onCollected;

        if (collisionMesh.physicsImpostor) {
            registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
            collisionCallback = () => {
                collectPowerup(currentOnCollected);
            };
            collisionMesh.physicsImpostor.registerOnPhysicsCollide(mesh.physicsImpostor, collisionCallback);
        }
    };

    const collectPowerup = (onCollected) => {
        if (!activePowerup) return;

        const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
        const powerupToRemove = activePowerup;

        //direct null zetten als powerup wordt gepakt
        activePowerup = null;

        if (collisionMesh.physicsImpostor && powerupToRemove.physicsImpostor && collisionCallback) {
            collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(powerupToRemove.physicsImpostor, collisionCallback);
            collisionCallback = null;
        }

        //veilig verwijderen
        scene.onAfterPhysicsObservable.addOnce(() => {
            if (powerupToRemove) {
                if (powerupToRemove.physicsImpostor) powerupToRemove.physicsImpostor.dispose();
                powerupToRemove.dispose();
            }
        });

        isShooting = true;
        showPopup();
        if (onCollected) onCollected(true);
    };

    updateObserver = scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000.0;

        //check for dynamic hitbox changes (e.g. shield toggle)
        if (activePowerup && activePowerup.physicsImpostor) {
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            if (collisionMesh.physicsImpostor && collisionMesh.physicsImpostor.uniqueId !== registeredImpostorId) {
                //re-register collision
                registeredImpostorId = collisionMesh.physicsImpostor.uniqueId;
                collisionCallback = () => {
                    collectPowerup(currentOnCollected);
                };
                collisionMesh.physicsImpostor.registerOnPhysicsCollide(activePowerup.physicsImpostor, collisionCallback);
            }
        }

        if (activePowerup && activePowerup.physicsImpostor) {
            if (activePowerup.position.y <= CONFIG.hoverHeight) {
                activePowerup.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                activePowerup.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                activePowerup.position.y = CONFIG.hoverHeight;
                activePowerup.physicsImpostor.forceUpdate();
            }
        }

        if (isShooting && projectileManager) {
            shootTimer += dt;
            if (shootTimer >= CONFIG.fireRate) {
                shootTimer = 0;
                projectileManager.shootProjectile(
                    rocketship.position.clone(),
                    CONFIG.projectileSpeed,
                    null,
                    true
                );
            }
        }
    });

    //reset functie voor level restarts
    const reset = () => {
        if (activePowerup) {
            const collisionMesh = rocketship.metadata?.collisionMesh || rocketship;
            const powerupToRemove = activePowerup;
            activePowerup = null;

            //stop de engine voor collisions te watchen
            if (collisionMesh.physicsImpostor && collisionCallback) {
                collisionMesh.physicsImpostor.unregisterOnPhysicsCollide(collisionCallback);
                collisionCallback = null;
            }

            //veilig verwijderen
            scene.onAfterPhysicsObservable.addOnce(() => {
                if (powerupToRemove) {
                    if (powerupToRemove.physicsImpostor) powerupToRemove.physicsImpostor.dispose();
                    powerupToRemove.dispose();
                }
            });
        }
        isShooting = false;
        shootTimer = 0;
    };

    const cleanup = () => {
        if (updateObserver) {
            scene.onBeforeRenderObservable.remove(updateObserver);
            updateObserver = null;
        }
        reset();
        if (uiTexture) uiTexture.dispose();
    };

    return {
        spawnPowerup,
        reset,
        cleanup,
        isActive: () => isShooting
    };
};