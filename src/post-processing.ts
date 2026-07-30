// ============================================================
// post-processing.ts — WebGPU cinematic render pipeline
// ============================================================
//
// Chain (official three.js TSL post nodes):
//   scene pass (MRT color + normal)
//   → GTAO (sky-protected)
//   → Bloom (emissive highlights / sun)
//   → cinematic grade (contrast, sat, teal-orange lift)
//   → vignette
//   → film grain
//   → tone map (renderOutput)
//   → FXAA
//

import * as THREE from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  normalView,
  vec3,
  vec4,
  mix,
  float,
  pow,
  smoothstep,
  max,
  clamp,
  viewportUV,
  renderOutput,
  luminance,
  uniform,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { CFG } from './config';
import type { Game } from './types';

interface AoPassNode {
  resolutionScale: number;
  useTemporalFiltering: boolean;
  samples: { value: number };
  radius: { value: number };
  scale: { value: number };
  thickness: { value: number };
  distanceExponent: { value: number };
  distanceFallOff: { value: number };
  getTextureNode(): { r: unknown };
}

interface BloomPassNode {
  strength: { value: number };
  radius: { value: number };
  threshold: { value: number };
}

export class PostProcessing {
  enabled: boolean;
  private _renderer: THREE.WebGPURenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _pipeline: THREE.RenderPipeline | null = null;
  private _aoPass: AoPassNode | null = null;
  private _bloomPass: BloomPassNode | null = null;
  private _dofFocus: { value: number } | null = null;
  private _dofLastUpdate = 0;
  private _failed = false;
  private _initAttempted = false;
  private _game: Game;

  constructor(game: Game) {
    this._game = game;
    this._renderer = game.renderer;
    this._scene = game.scene;
    this._camera = game.camera;
    this.enabled = CFG.POST.enabled;
  }

  private _ensurePipeline(): boolean {
    if (this._pipeline) return true;
    if (this._failed || this._initAttempted) return false;
    this._initAttempted = true;
    try {
      this._buildPipeline();
      return this._pipeline !== null;
    } catch (err) {
      console.warn('[PostProcessing] Cinematic pipeline init failed; using direct render', err);
      this._failed = true;
      this._pipeline = null;
      return false;
    }
  }

  private _buildPipeline(): void {
    const aoCfg = CFG.SSAO;
    const cine = CFG.CINEMATIC;
    const bloomCfg = CFG.BLOOM;
    const dofCfg = CFG.DOF;

    const scenePass = pass(this._scene, this._camera);
    (scenePass as { transparent?: boolean }).transparent = true;
    scenePass.setMRT(
      mrt({
        output,
        normal: normalView,
      }),
    );

    const colorNode = scenePass.getTextureNode('output');
    let sceneColor = colorNode;
    if (dofCfg.enabled && this._canUseDof()) {
      const focusDistance = uniform(dofCfg.defaultFocus);
      this._dofFocus = focusDistance;
      sceneColor = dof(
        colorNode,
        scenePass.getViewZNode(),
        focusDistance,
        float(dofCfg.focalLength),
        float(dofCfg.bokehScale),
      );
    }
    const normalNode = scenePass.getTextureNode('normal');
    const depthNode = scenePass.getTextureNode('depth');

    // --- GTAO ---
    const aoPass = ao(depthNode, normalNode, this._camera) as unknown as AoPassNode;
    aoPass.resolutionScale = aoCfg.resolutionScale;
    aoPass.useTemporalFiltering = false;
    aoPass.samples.value = aoCfg.samples;
    aoPass.radius.value = aoCfg.radius;
    aoPass.scale.value = aoCfg.scale;
    aoPass.thickness.value = aoCfg.thickness;
    aoPass.distanceExponent.value = aoCfg.distanceExponent;
    aoPass.distanceFallOff.value = aoCfg.distanceFallOff;
    this._aoPass = aoPass;

    const aoFactor = aoPass.getTextureNode().r as ReturnType<typeof float>;
    const linearDepth = scenePass.getLinearDepthNode() as {
      lessThan: (v: number) => { select: (a: unknown, b: unknown) => unknown };
    };
    const skyProtect = linearDepth.lessThan(0.98).select(float(1), float(0)) as ReturnType<typeof float>;
    const aoAmt = float(aoCfg.intensity).mul(skyProtect);
    const aoColor = mix(sceneColor.rgb, sceneColor.rgb.mul(vec3(aoFactor)), aoAmt);
    let graded = vec4(aoColor, sceneColor.a);

    // --- Bloom (sun disc, lamps, crystals) ---
    if (bloomCfg.enabled) {
      const bloomPass = bloom(
        graded,
        bloomCfg.strength,
        bloomCfg.radius,
        bloomCfg.threshold,
      ) as unknown as BloomPassNode & { rgb: unknown };
      this._bloomPass = bloomPass;
      graded = vec4(graded.rgb.add((bloomPass as unknown as { rgb: ReturnType<typeof vec3> }).rgb), graded.a);
    }

    // --- Cinematic color grade ---
    // Pivot contrast at ~0.42 (slightly under mid) so dark voxels don't crush.
    let rgb = graded.rgb;
    const pivot = float(0.42);
    rgb = rgb.sub(pivot).mul(float(cine.contrast)).add(pivot);
    // Saturation after contrast so contrast does not re-grey mids.
    const luma = luminance(rgb);
    rgb = mix(vec3(luma), rgb, float(cine.saturation));
    // Soft teal/orange split with wide smoothsteps (no hard band at horizon).
    const shadowMask = smoothstep(float(0.42), float(0.05), luma);
    const highMask = smoothstep(float(0.55), float(0.92), luma);
    rgb = rgb.add(vec3(cine.shadowLift.r, cine.shadowLift.g, cine.shadowLift.b).mul(shadowMask));
    rgb = rgb.add(vec3(cine.highlightWarm.r, cine.highlightWarm.g, cine.highlightWarm.b).mul(highMask));
    // Film-like mid response then overall gain; soft clamp protects the sky dome.
    rgb = pow(max(rgb, vec3(0.0)), vec3(cine.gamma));
    rgb = rgb.mul(float(cine.gain));
    rgb = clamp(rgb, vec3(0.0), vec3(cine.clip));

    // --- Vignette (elliptical-ish via scale; keeps crosshair area clear) ---
    const uv = viewportUV.sub(0.5);
    const vigDist = uv.length().mul(float(cine.vignetteScale));
    const vig = float(1).sub(
      smoothstep(float(cine.vignetteStart), float(cine.vignetteEnd), vigDist).mul(float(cine.vignetteStrength)),
    );
    rgb = rgb.mul(vig);

    let frame = vec4(rgb, graded.a);

    // --- Film grain ---
    if (cine.grain > 0.001) {
      frame = film(frame, float(cine.grain)) as unknown as typeof frame;
    }

    // FXAA needs display-space contrast; applying it before tone mapping makes
    // its edge detection unstable around HDR highlights.
    const pipeline = new THREE.RenderPipeline(this._renderer);
    pipeline.outputColorTransform = false;
    let outNode: unknown = renderOutput(frame, this._renderer.toneMapping, this._renderer.outputColorSpace);
    if (cine.fxaa) {
      outNode = fxaa(outNode as never);
    }
    pipeline.outputNode = outNode as never;
    this._pipeline = pipeline;
  }

  private _canUseDof(): boolean {
    if (CFG.DOF.mobileEnabled || typeof matchMedia === 'undefined') return true;
    return !matchMedia('(pointer: coarse)').matches;
  }

  private _updateDofFocus(): void {
    if (!this._dofFocus) return;
    const dofCfg = CFG.DOF;
    const targetDistance = this._game.player.target?.dist ?? dofCfg.defaultFocus;
    const desiredFocus = Math.min(dofCfg.maxFocus, Math.max(dofCfg.minFocus, targetDistance));
    const now = performance.now();
    const elapsed = this._dofLastUpdate === 0 ? 0 : Math.min((now - this._dofLastUpdate) / 1000, 0.1);
    this._dofLastUpdate = now;
    const blend = 1 - Math.exp(-dofCfg.focusSmoothing * elapsed);
    this._dofFocus.value += (desiredFocus - this._dofFocus.value) * blend;
  }

  applySettings(): void {
    const aoCfg = CFG.SSAO;
    const bloomCfg = CFG.BLOOM;
    this.enabled = CFG.POST.enabled;
    if (this._aoPass) {
      this._aoPass.resolutionScale = aoCfg.resolutionScale;
      this._aoPass.samples.value = aoCfg.samples;
      this._aoPass.radius.value = aoCfg.radius;
      this._aoPass.scale.value = aoCfg.scale;
      this._aoPass.thickness.value = aoCfg.thickness;
      this._aoPass.distanceExponent.value = aoCfg.distanceExponent;
      this._aoPass.distanceFallOff.value = aoCfg.distanceFallOff;
    }
    if (this._bloomPass) {
      this._bloomPass.strength.value = bloomCfg.strength;
      this._bloomPass.radius.value = bloomCfg.radius;
      this._bloomPass.threshold.value = bloomCfg.threshold;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  resize(_width: number, _height: number): void {
    // The renderer owns drawing-buffer size, avoiding a second resize source
    // that can desynchronize post-process targets on device-pixel-ratio changes.
  }

  render(): void {
    this._updateDofFocus();
    if (this.enabled && this._ensurePipeline() && this._pipeline) {
      try {
        this._pipeline.render();
        return;
      } catch (err) {
        console.warn('[PostProcessing] Cinematic render failed; falling back to direct render', err);
        this._failed = true;
        this._pipeline = null;
      }
    }
    this._renderer.render(this._scene, this._camera);
  }
}
