import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.42 },
    desat: { value: 0.25 },
    uTime: { value: 0 }
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
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.35, 0.95, d) * intensity;
      float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, vec3(gray), vig * desat);
      c.rgb *= 1.0 - vig;
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime * 61.7) * 43758.5453);
      c.rgb += (n - 0.5) * 0.032;
      gl_FragColor = c;
    }
  `
};

const SharpenShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.3 },
    texelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) }
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
    uniform float strength;
    uniform vec2 texelSize;
    varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + vec2(-texelSize.x, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y)).rgb;
      blur += texture2D(tDiffuse, vUv + vec2(0.0, -texelSize.y)).rgb;
      blur *= 0.25;
      vec3 detail = clamp((base - blur) * strength, vec3(-0.25), vec3(0.25));
      gl_FragColor = vec4(base + detail, 1.0);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

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
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.max(size.x * 0.5, 1), Math.max(size.y * 0.5, 1)),
      0.25,
      0.45,
      1.0
    );
    this.composer.addPass(this.bloom);
    this.sharpen = new ShaderPass(SharpenShader);
    this.sharpen.uniforms.texelSize.value.set(1 / size.x, 1 / size.y);
    this.composer.addPass(this.sharpen);
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
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.bloom.setSize(Math.max(size.x * 0.5, 1), Math.max(size.y * 0.5, 1));
    this.sharpen.uniforms.texelSize.value.set(1 / Math.max(size.x, 1), 1 / Math.max(size.y, 1));
  }

  setDamageIntensity(v) {
    this.vignette.uniforms.intensity.value = 0.42 + v * 0.45;
    this.vignette.uniforms.desat.value = 0.25 + v * 0.6;
  }

  render() {
    this.vignette.uniforms.uTime.value = (performance.now() * 0.001) % 3600;
    this.composer.render();
  }

  dispose() {
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
