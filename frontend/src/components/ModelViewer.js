import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
// OrbitControls removed - using fixed camera for hologram environment
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

// Error boundary component for debugging
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
        console.error('🚨 [ModelViewer] Error boundary caught:', error, errorInfo);
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    color: 'red', 
                    padding: '20px', 
                    backgroundColor: '#222',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <h2>🚨 3D Viewer Error</h2>
                    <p>Error: {this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()}>Reload Page</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// 3D Model Loader Component with specific technical fixes
function Model3D({ modelUrl }) {
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [geometryBounds, setGeometryBounds] = useState(null);
    const meshRef = useRef();
    
    // Hologram animation with shader uniforms
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
            
            // Animate hologram shader uniforms if material has them
            if (meshRef.current.material && meshRef.current.material.uniforms) {
                meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
            }
        }
    });

    useEffect(() => {
        if (!modelUrl) return;
        
        console.log('🚀 [HologramEnvironment] Loading 3D model from:', modelUrl);
        setLoading(true);
        setError(null);
        setModel(null);
        
        const loader = new OBJLoader();
        
        loader.load(
            modelUrl,
            // Success callback
            (object) => {
                console.log('✅ [HologramEnvironment] Model loaded successfully:', object);
                
                // Find the first mesh in the loaded object
                let mesh = null;
                let geometry = null;
                
                object.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        mesh = child;
                        geometry = child.geometry;
                        return;
                    }
                });
                
                if (mesh && geometry) {
                    console.log('🎯 [HologramEnvironment] Found mesh with geometry:', geometry);
                    console.log('  └─ Vertices:', geometry.attributes.position.count);
                    
                    // CRITICAL: Geometry bounds checking and logging
                    geometry.computeBoundingBox();
                    const bbox = geometry.boundingBox;
                    console.log('📏 [HologramEnvironment] Geometry bounds:', bbox);
                    console.log('  └─ Min:', bbox.min);
                    console.log('  └─ Max:', bbox.max);
                    console.log('  └─ Size:', {
                        x: bbox.max.x - bbox.min.x,
                        y: bbox.max.y - bbox.min.y,
                        z: bbox.max.z - bbox.min.z
                    });
                    
                    setGeometryBounds(bbox);
                    
                    // HOLOGRAM ENVIRONMENT: Enhanced model positioning for fixed camera (8, 6, 8)
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    const size = new THREE.Vector3();
                    bbox.getSize(size);
                    
                    // Calculate scale to fit model optimally for hologram display (max dimension = 2 units)
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    const targetSize = 2; // Smaller for better hologram effect visibility
                    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
                    
                    console.log('🎯 [HologramEnvironment] Model positioning for fixed camera:');
                    console.log('  └─ Center offset:', center);
                    console.log('  └─ Original size:', size);
                    console.log('  └─ Scale factor:', scale);
                    console.log('  └─ Camera view: (8, 6, 8) -> (0, 0, 0)');
                    
                    // HOLOGRAM MATERIAL: Custom shader for hologram effects
                    const material = createHologramMaterial();
                    
                    // Create new mesh with hologram material and positioning
                    const newMesh = new THREE.Mesh(geometry, material);
                    newMesh.scale.set(scale, scale, scale);
                    
                    // HOLOGRAM POSITIONING: Center horizontally, position slightly above ground
                    newMesh.position.set(
                        -center.x * scale, // Center on X-axis
                        (-center.y * scale) + 1, // Center on Y-axis + lift above ground
                        -center.z * scale  // Center on Z-axis
                    );
                    
                    setModel(newMesh);
                    setLoading(false);
                    console.log('🎉 [HologramEnvironment] Model ready for hologram display from fixed camera position!');
                } else {
                    console.error('❌ [HologramEnvironment] No mesh found in loaded object');
                    setError('No 3D geometry found in file');
                    setLoading(false);
                }
            },
            // Progress callback
            (progress) => {
                const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
                console.log(`📊 [HologramEnvironment] Loading progress: ${percent.toFixed(1)}%`);
            },
            // Error callback
            (error) => {
                console.error('❌ [HologramEnvironment] Failed to load model:', error);
                setError('Failed to load 3D model: ' + error.message);
                setLoading(false);
            }
        );
    }, [modelUrl]);

    // Loading state - yellow cube
    if (loading) {
        return (
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhongMaterial color="#ffff00" />
            </mesh>
        );
    }

    // Error state - red cube
    if (error) {
        return (
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhongMaterial color="#ff0000" />
            </mesh>
        );
    }

    // Loaded model
    if (model) {
        return <primitive ref={meshRef} object={model} />;
    }

    return null;
}

// Test cube for debugging Three.js rendering with hologram effects
function TestCube() {
    const meshRef = useRef();
    const [material] = useState(() => createHologramMaterial());
    
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += 0.01;
            meshRef.current.rotation.y += 0.01;
            
            // Animate hologram shader
            if (meshRef.current.material && meshRef.current.material.uniforms) {
                meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
            }
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]} material={material}>
            <boxGeometry args={[2, 2, 2]} />
        </mesh>
    );
}

// Hologram Shader Material - Phase 2 Implementation
const createHologramMaterial = () => {
    const hologramVertexShader = `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const hologramFragmentShader = `
        uniform float time;
        uniform vec3 color;
        uniform float glowIntensity;
        uniform float scanSpeed;
        uniform float flickerRate;
        
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        varying vec2 vUv;
        
        void main() {
            // Fresnel effect for edge glow
            float fresnel = pow(1.0 - abs(dot(vNormal, vPositionNormal)), 2.5);
            
            // Scan lines effect
            float scanline = sin(gl_FragCoord.y * 0.01 + time * scanSpeed) * 0.05 + 0.95;
            
            // Hologram flicker effect
            float flicker = sin(time * flickerRate) * 0.02 + 0.98;
            
            // Additional hologram distortion
            float distortion = sin(vUv.y * 20.0 + time * 2.0) * 0.01;
            
            // Combine effects
            vec3 glow = color * (fresnel * glowIntensity + 0.1);
            float alpha = (fresnel * 0.7 + 0.3) * scanline * flicker;
            
            gl_FragColor = vec4(glow + distortion, alpha);
        }
    `;

    return new THREE.ShaderMaterial({
        vertexShader: hologramVertexShader,
        fragmentShader: hologramFragmentShader,
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x00ffff) },
            glowIntensity: { value: 1.5 },
            scanSpeed: { value: 5.0 },
            flickerRate: { value: 15.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
};

// Main ModelViewer Component - HOLOGRAM ENVIRONMENT MODE
function ModelViewer({ modelUrl, showTestCube = false }) {
    return (
        <ErrorBoundary>
            <div style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }}>
                <Canvas
                    // HOLOGRAM MODE: Fixed camera position (8, 6, 8) - NO ORBIT CONTROLS
                    camera={{ 
                        position: [8, 6, 8], // Fixed position as specified for hologram environment
                        fov: 75,
                        near: 0.1,
                        far: 1000
                    }}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        minHeight: '400px',
                        backgroundColor: '#000',
                        display: 'block'
                    }}
                    onCreated={(state) => {
                        console.log('🎬 [HologramEnvironment] WebGL context created successfully');
                        console.log('  └─ Renderer:', state.gl.getParameter(state.gl.VERSION));
                        console.log('  └─ Fixed Camera Position:', state.camera.position);
                        console.log('  └─ Camera FOV:', state.camera.fov);
                        console.log('  └─ Canvas size:', state.size);
                        // CRITICAL: Camera always looks at origin (0, 0, 0)
                        state.camera.lookAt(0, 0, 0);
                    }}
                >
                    {/* HOLOGRAM ENVIRONMENT: Professional 3-Point Lighting System */}
                    <ambientLight intensity={0.3} color="#404040" />
                    <directionalLight position={[10, 10, 5]} intensity={0.8} color="#ffffff" />
                    <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#4444ff" />
                    
                    {/* 3D Content positioned for hologram display */}
                    {showTestCube ? <TestCube /> : null}
                    {modelUrl && !showTestCube ? <Model3D modelUrl={modelUrl} /> : null}
                    
                    {/* NO ORBIT CONTROLS - Fixed camera for hologram environment */}
                    {/* OrbitControls removed for professional hologram setup */}
                </Canvas>
            </div>
        </ErrorBoundary>
    );
}

export default ModelViewer;