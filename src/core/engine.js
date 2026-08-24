import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.55 },
    desat: { value: 0.25 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float desat;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.35, 0.95, d) * intensity;
      float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, vec3(gray), vig * desat);
      c.rgb *= 1.0 - vig;
      gl_FragColor = c;
    }
  `
};

export class Engine {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.05,
      900
    );
    this.camera.rotation.order = 'YXZ';

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.4, 1.0);
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteShader);
    this.vignette.renderToScreen = true;
    this.composer.addPass(this.vignette);

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const el = this.renderer.domElement.parentElement || document.body;
    const w = el.clientWidth;
    const h = el.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  setDamageIntensity(v) {
    this.vignette.uniforms.intensity.value = 0.55 + v * 0.45;
    this.vignette.uniforms.desat.value = 0.25 + v * 0.6;
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
  }
}
