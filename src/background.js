import * as BABYLON from '@babylonjs/core';

BABYLON.Effect.ShadersStore["starfieldVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    void main() {
        gl_Position = worldViewProjection * vec4(position, 1.0);
    }
`;

BABYLON.Effect.ShadersStore["starfieldPixelShader"] = `
    precision highp float;
    uniform float time;
    uniform vec2 resolution;

    // --- SETTINGS ---
    // Change this to -1.0 if they are still flying the wrong way!
    #define DIRECTION -1.0 
    #define SPEED 0.05
    #define LAYERS 20.0
    #define DEPTH 30.0

    // Math Helper for color gamma
    vec4 tanh_approx_vec4(vec4 v) {
        vec4 exp2x = exp(2.0 * v);
        return (exp2x - 1.0) / (exp2x + 1.0);
    }

    void main(void) {
        vec4 color = vec4(0.0);
        
        // Center of the screen is (0,0)
        vec2 centeredI = gl_FragCoord.xy - resolution.xy * 0.5;

        for(float i = 1.0; i < LAYERS; i++) {
            
            // --- THE DIRECTION LOGIC ---
            // 1. We create a value 't' that loops continuously.
            // 2. We multiply by DIRECTION. 
            //    If DIRECTION is 1.0, 't' gets bigger. 
            //    If DIRECTION is -1.0, 't' gets smaller.
            float t = time * SPEED * DIRECTION;

            // 3. We offset 't' by the layer index 'i' so layers don't move together
            float z = fract(i / LAYERS + t);

            // 4. Map 'z' (0 to 1) to actual Depth (50 to 0)
            // We want stars to come from 50 (Far) to 0 (Face).
            // So we invert it: (1.0 - z)
            float depth = DEPTH * (1.0 - z);
            
            // Safety Clamp (Don't divide by zero)
            depth = max(depth, 0.1);

            // --- PROJECTION ---
            // As 'depth' gets smaller (closer), the position multiplier gets HUGE.
            // This makes stars explode OUTWARDS from the center.
            vec2 pos = centeredI / resolution.y * (150.0 / depth);

            // Randomize position
            pos += cos(i * vec2(9.0, 7.0));
            
            // --- DRAWING ---
            float dist = length(sin(pos));
            
            // Fade out if too far (depth > 40) or too close (depth < 2)
            float fade = smoothstep(DEPTH, DEPTH * 0.8, depth) * smoothstep(0.0, 2.0, depth);
            
            // Rainbow colors based on layer index
            vec4 layerColor = (i * cos(i + vec4(0.0, 2.0, 4.0, 0.0)) + i);
            
            // Add light
            color += layerColor * 0.0003 / dist * fade;
        }
        
        color = tanh_approx_vec4(color * color);
        gl_FragColor = vec4(color.rgb, 1.0);
    }
`;

export const createBackground = (scene) => {
    const plane = BABYLON.MeshBuilder.CreatePlane("starfieldPlane", { size: 1000.0 }, scene);
    plane.position.z = 100;
    plane.infiniteDistance = true;

    const shaderMaterial = new BABYLON.ShaderMaterial("starfieldMat", scene, {
        vertex: "starfield",
        fragment: "starfield",
    },
        {
            attributes: ["position"],
            uniforms: ["worldViewProjection", "time", "resolution"]
        });

    shaderMaterial.backFaceCulling = false;
    plane.material = shaderMaterial;

    let time = 0;
    scene.registerBeforeRender(() => {
        time += scene.getEngine().getDeltaTime() / 1000.0;
        shaderMaterial.setFloat("time", time);
        shaderMaterial.setVector2("resolution", new BABYLON.Vector2(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight()));

        if (scene.activeCamera) {
            plane.position.x = scene.activeCamera.position.x;
            plane.position.y = scene.activeCamera.position.y;
        }
    });

    return plane;
};