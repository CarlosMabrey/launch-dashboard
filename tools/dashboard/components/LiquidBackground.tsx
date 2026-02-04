import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

function hexToVec3(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function getAuraColorsFromCss(): [string, string, string, string, string, string] {
  const style = getComputedStyle(document.documentElement);
  const get = (k: string, fallback: string) => (style.getPropertyValue(k).trim() || fallback);
  return [
    get('--aura-1', '#1a0a2e'),
    get('--aura-2', '#16213e'),
    get('--aura-3', '#0f3460'),
    get('--aura-4', '#533483'),
    get('--aura-5', '#0b1220'),
    get('--aura-6', '#2a0b3d'),
  ];
}

class TouchTexture {
  size = 64;
  width = this.size;
  height = this.size;
  maxAge = 64;
  radius = 0.25 * this.size;
  speed = 1 / this.maxAge;
  trail: { x: number; y: number; age: number; force: number; vx: number; vy: number }[] = [];
  last: { x: number; y: number } | null = null;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.Texture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create 2d context for TouchTexture');
    this.ctx = ctx;
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.Texture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  clear() {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      const d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 20000, 2.0);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point: { x: number; y: number; age: number; force: number; vx: number; vy: number }) {
    const pos = { x: point.x * this.width, y: (1 - point.y) * this.height };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = this.size * 5;

    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius;
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = 'rgba(255,0,0,1)';
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  update() {
    this.clear();
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const f = p.force * this.speed * (1 - p.age / this.maxAge);
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.age++;
      if (p.age > this.maxAge) this.trail.splice(i, 1);
      else this.drawPoint(p);
    }
    this.texture.needsUpdate = true;
  }
}

export default function LiquidBackground({ enabled }: { enabled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const shaders = useMemo(() => {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uColor5;
      uniform vec3 uColor6;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform sampler2D uTouchTexture;
      uniform float uGrainIntensity;
      uniform float uZoom;
      uniform vec3 uDarkNavy;
      uniform float uGradientSize;
      uniform float uGradientCount;
      uniform float uColor1Weight;
      uniform float uColor2Weight;

      varying vec2 vUv;

      float grain(vec2 uv, float time) {
        vec2 grainUv = uv * uResolution * 0.5;
        float g = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
        return g * 2.0 - 1.0;
      }

      vec2 rot(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
      }

      vec3 getGradientColor(vec2 uv, float time) {
        float r = uGradientSize;

        vec2 c1 = vec2(0.5 + sin(time*uSpeed*0.40)*0.40, 0.5 + cos(time*uSpeed*0.50)*0.40);
        vec2 c2 = vec2(0.5 + cos(time*uSpeed*0.60)*0.50, 0.5 + sin(time*uSpeed*0.45)*0.50);
        vec2 c3 = vec2(0.5 + sin(time*uSpeed*0.35)*0.45, 0.5 + cos(time*uSpeed*0.55)*0.45);
        vec2 c4 = vec2(0.5 + cos(time*uSpeed*0.50)*0.40, 0.5 + sin(time*uSpeed*0.40)*0.40);
        vec2 c5 = vec2(0.5 + sin(time*uSpeed*0.70)*0.35, 0.5 + cos(time*uSpeed*0.60)*0.35);
        vec2 c6 = vec2(0.5 + cos(time*uSpeed*0.45)*0.50, 0.5 + sin(time*uSpeed*0.65)*0.50);

        vec2 c7 = vec2(0.5 + sin(time*uSpeed*0.55)*0.38, 0.5 + cos(time*uSpeed*0.48)*0.42);
        vec2 c8 = vec2(0.5 + cos(time*uSpeed*0.65)*0.36, 0.5 + sin(time*uSpeed*0.52)*0.44);
        vec2 c9 = vec2(0.5 + sin(time*uSpeed*0.42)*0.41, 0.5 + cos(time*uSpeed*0.58)*0.39);
        vec2 c10 = vec2(0.5 + cos(time*uSpeed*0.48)*0.37, 0.5 + sin(time*uSpeed*0.62)*0.43);
        vec2 c11 = vec2(0.5 + sin(time*uSpeed*0.68)*0.33, 0.5 + cos(time*uSpeed*0.44)*0.46);
        vec2 c12 = vec2(0.5 + cos(time*uSpeed*0.38)*0.39, 0.5 + sin(time*uSpeed*0.56)*0.41);

        float d1 = length(uv-c1);
        float d2 = length(uv-c2);
        float d3 = length(uv-c3);
        float d4 = length(uv-c4);
        float d5 = length(uv-c5);
        float d6 = length(uv-c6);
        float d7 = length(uv-c7);
        float d8 = length(uv-c8);
        float d9 = length(uv-c9);
        float d10 = length(uv-c10);
        float d11 = length(uv-c11);
        float d12 = length(uv-c12);

        float i1 = 1.0 - smoothstep(0.0, r, d1);
        float i2 = 1.0 - smoothstep(0.0, r, d2);
        float i3 = 1.0 - smoothstep(0.0, r, d3);
        float i4 = 1.0 - smoothstep(0.0, r, d4);
        float i5 = 1.0 - smoothstep(0.0, r, d5);
        float i6 = 1.0 - smoothstep(0.0, r, d6);
        float i7 = 1.0 - smoothstep(0.0, r, d7);
        float i8 = 1.0 - smoothstep(0.0, r, d8);
        float i9 = 1.0 - smoothstep(0.0, r, d9);
        float i10 = 1.0 - smoothstep(0.0, r, d10);
        float i11 = 1.0 - smoothstep(0.0, r, d11);
        float i12 = 1.0 - smoothstep(0.0, r, d12);

        vec2 ru1 = uv - 0.5;
        ru1 = rot(ru1, time*uSpeed*0.15) + 0.5;
        vec2 ru2 = uv - 0.5;
        ru2 = rot(ru2, -time*uSpeed*0.12) + 0.5;

        float rg1 = length(ru1-0.5);
        float rg2 = length(ru2-0.5);
        float ri1 = 1.0 - smoothstep(0.0, 0.8, rg1);
        float ri2 = 1.0 - smoothstep(0.0, 0.8, rg2);

        vec3 col = vec3(0.0);
        col += uColor1 * i1 * (0.55 + 0.45*sin(time*uSpeed)) * uColor1Weight;
        col += uColor2 * i2 * (0.55 + 0.45*cos(time*uSpeed*1.2)) * uColor2Weight;
        col += uColor3 * i3 * (0.55 + 0.45*sin(time*uSpeed*0.8)) * uColor1Weight;
        col += uColor4 * i4 * (0.55 + 0.45*cos(time*uSpeed*1.3)) * uColor2Weight;
        col += uColor5 * i5 * (0.55 + 0.45*sin(time*uSpeed*1.1)) * uColor1Weight;
        col += uColor6 * i6 * (0.55 + 0.45*cos(time*uSpeed*0.9)) * uColor2Weight;

        if (uGradientCount > 6.0) {
          col += uColor1 * i7 * (0.55 + 0.45*sin(time*uSpeed*1.4)) * uColor1Weight;
          col += uColor2 * i8 * (0.55 + 0.45*cos(time*uSpeed*1.5)) * uColor2Weight;
          col += uColor3 * i9 * (0.55 + 0.45*sin(time*uSpeed*1.6)) * uColor1Weight;
          col += uColor4 * i10 * (0.55 + 0.45*cos(time*uSpeed*1.7)) * uColor2Weight;
        }
        if (uGradientCount > 10.0) {
          col += uColor5 * i11 * (0.55 + 0.45*sin(time*uSpeed*1.8)) * uColor1Weight;
          col += uColor6 * i12 * (0.55 + 0.45*cos(time*uSpeed*1.9)) * uColor2Weight;
        }

        col += mix(uColor1, uColor3, ri1) * 0.45 * uColor1Weight;
        col += mix(uColor2, uColor4, ri2) * 0.40 * uColor2Weight;

        col = clamp(col, vec3(0.0), vec3(1.0)) * uIntensity;

        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(lum), col, 1.35);
        col = pow(col, vec3(0.92));

        float b = length(col);
        float mf = max(b * 1.2, 0.15);
        col = mix(uDarkNavy, col, mf);

        return col;
      }

      void main() {
        vec2 uv = vUv;
        uv = (uv - 0.5) / uZoom + 0.5;

        vec4 touchTex = texture2D(uTouchTexture, uv);
        float vx = -(touchTex.r * 2.0 - 1.0);
        float vy = -(touchTex.g * 2.0 - 1.0);
        float inten = touchTex.b;

        uv.x += vx * 0.8 * inten;
        uv.y += vy * 0.8 * inten;

        vec2 center = vec2(0.5);
        float dist = length(uv - center);
        float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.04 * inten;
        float wave = sin(dist * 15.0 - uTime * 2.0) * 0.03 * inten;
        uv += vec2(ripple + wave);

        vec3 col = getGradientColor(uv, uTime);

        float g = grain(uv, uTime);
        col += g * uGrainIntensity;

        col = clamp(col, vec3(0.0), vec3(1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    return { vertexShader, fragmentShader };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false, depth: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '-20';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0e27');

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.z = 50;

    const touch = new TouchTexture();

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColor1: { value: hexToVec3('#f15a22') },
      uColor2: { value: hexToVec3('#0a0e27') },
      uColor3: { value: hexToVec3('#f15a22') },
      uColor4: { value: hexToVec3('#0a0e27') },
      uColor5: { value: hexToVec3('#f15a22') },
      uColor6: { value: hexToVec3('#0a0e27') },
      uSpeed: { value: 1.2 },
      uIntensity: { value: 1.2 },
      uTouchTexture: { value: touch.texture },
      uGrainIntensity: { value: 0.04 },
      uZoom: { value: 1.0 },
      uDarkNavy: { value: hexToVec3('#0a0e27') },
      uGradientSize: { value: 0.45 },
      uGradientCount: { value: 12.0 },
      uColor1Weight: { value: 0.7 },
      uColor2Weight: { value: 1.6 },
    };

    const viewSize = () => {
      const fov = (camera.fov * Math.PI) / 180;
      const height = Math.abs(camera.position.z * Math.tan(fov / 2) * 2);
      return { width: height * camera.aspect, height };
    };

    const geometry = new THREE.PlaneGeometry(viewSize().width, viewSize().height, 1, 1);
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: shaders.vertexShader, fragmentShader: shaders.fragmentShader });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const onMouseMove = (ev: MouseEvent) => {
      touch.addTouch({ x: ev.clientX / window.innerWidth, y: 1 - ev.clientY / window.innerHeight });
    };
    const onTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      touch.addTouch({ x: t.clientX / window.innerWidth, y: 1 - t.clientY / window.innerHeight });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      (uniforms.uResolution.value as THREE.Vector2).set(window.innerWidth, window.innerHeight);
      const vs = viewSize();
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(vs.width, vs.height, 1, 1);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      uniforms.uTime.value += delta;
      touch.update();

      const css = getAuraColorsFromCss();
      (uniforms.uColor1.value as THREE.Vector3).copy(hexToVec3(css[0]));
      (uniforms.uColor2.value as THREE.Vector3).copy(hexToVec3(css[1]));
      (uniforms.uColor3.value as THREE.Vector3).copy(hexToVec3(css[2]));
      (uniforms.uColor4.value as THREE.Vector3).copy(hexToVec3(css[3]));
      (uniforms.uColor5.value as THREE.Vector3).copy(hexToVec3(css[4]));
      (uniforms.uColor6.value as THREE.Vector3).copy(hexToVec3(css[5]));
      (uniforms.uDarkNavy.value as THREE.Vector3).copy(hexToVec3(css[1]));
      scene.background = new THREE.Color(css[1]);

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  }, [enabled, shaders.vertexShader, shaders.fragmentShader]);

  return <div ref={containerRef} aria-hidden="true" />;
}
