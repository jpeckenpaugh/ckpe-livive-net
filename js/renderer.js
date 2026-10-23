/**
 * CKPE Front-View Canvas 2D Renderer.
 * Projects 3D biomechanical rig onto 2D canvas with calibrated video/image underlays.
 */

import { DEG, v3, vAdd, vScale, vDot, vNorm } from './math3d.js';

export class CKPERenderer {
  constructor(canvas, rig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rig = rig;
    this.dpr = window.devicePixelRatio || 1;

    // Fixed orthographic Front camera
    this.camera = {
      id: 'front',
      label: 'FRONT',
      right: v3(1, 0, 0),
      up: v3(0, 1, 0),
      forward: v3(0, 0, -1)
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w > 0 && h > 0) {
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
    }
  }

  render(options = {}) {
    const { ctx, canvas, rig, camera, dpr } = this;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const skel = rig.computeSkeleton(options.rigState);
    const displayMode = options.displayMode || 'overlay'; // 'overlay', 'rig', 'sample'

    // Coordinate projector for Front View
    // Rig reference bounds:
    // Pelvis Y ~ 0, C7 Y ~ 45, Head Crown Y ~ 72, Arm span ~ 120
    const margin = 20;
    const viewW = width - margin * 2;
    const viewH = height - margin * 2;

    // Anchor center X at width / 2, baseline pelvis Y at bottom area
    const worldCenterX = 0;
    const worldCenterY = 32; // mid-chest
    const worldSpan = 90; // vertical span in rig units

    const scale = Math.min(viewW / 85, viewH / worldSpan);
    const screenCenterX = width / 2;
    const screenCenterY = height / 2 + 10;

    const project = (pt) => ({
      x: screenCenterX + (pt.x - worldCenterX) * scale,
      y: screenCenterY - (pt.y - worldCenterY) * scale,
      depth: pt.z
    });

    const view = { x: margin, y: margin, w: viewW, h: viewH };

    // 1. Draw Sample Underlay (if mode is 'overlay' or 'sample')
    if (displayMode !== 'rig' && options.underlay) {
      const alpha = displayMode === 'sample' ? 1.0 : (options.overlayAlpha !== undefined ? options.overlayAlpha : 0.50);
      this.drawUnderlay(ctx, options.underlay, view, project, options.calib, alpha);
    }

    // 2. Draw Floor/Wall Grid
    if (displayMode !== 'sample') {
      this.drawFrontGrid(ctx, project, width, height);
      this.drawGroundShadow(ctx, skel, project, scale);
    }

    // 3. Draw Skeleton & Joints
    if (displayMode !== 'sample') {
      this.drawHead(ctx, skel, project, scale);
      this.drawSegments(ctx, skel, project);
      this.drawJoints(ctx, skel, project);

      // Draw right hand tip tracking marker if available
      if (options.rightHandTip && options.calib && options.calib.grid_width) {
        this.drawHandTipMarker(ctx, options.rightHandTip, project, options.calib, options.underlay);
      }
    }

    ctx.restore();
  }

  drawUnderlay(ctx, media, view, project, calib, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const natW = media.videoWidth || media.naturalWidth || 640;
    const natH = media.videoHeight || media.naturalHeight || 480;

    if (calib && calib.grid_width) {
      // Map calibrated grid coordinates to native image pixels
      const gridScaleX = natW / calib.grid_width;
      const gridScaleY = natH / calib.grid_height;

      // Model's reference shoulder span on screen
      const baseSkel = this.rig.computeSkeleton(this.rig.defaultState);
      const pC7 = project(baseSkel.c7);
      const pRightShoulder = project(baseSkel.rightShoulder);
      const pLeftShoulder = project(baseSkel.leftShoulder);

      const rigShoulderSpanPx = Math.hypot(
        pLeftShoulder.x - pRightShoulder.x,
        pLeftShoulder.y - pRightShoulder.y
      );

      // Signer's anatomical shoulder center & skeletal span in image pixels
      const imgCenter_x = (calib.center_x !== undefined ? calib.center_x : 78.75) * gridScaleX;
      const calibShoulderY = (calib.shoulder_y && calib.shoulder_y <= 65) ? calib.shoulder_y : 58.75;
      const imgShoulder_y = calibShoulderY * gridScaleY;

      const skeletalHalfPx = (calib.skeletal_shoulder_half_px && calib.skeletal_shoulder_half_px <= 25)
        ? calib.skeletal_shoulder_half_px
        : 23.75;
      const imgShoulderSpanPx = skeletalHalfPx * 2 * gridScaleX;

      const alignScale = rigShoulderSpanPx / imgShoulderSpanPx;
      const drawW = natW * alignScale;
      const drawH = natH * alignScale;
      const drawX = pC7.x - imgCenter_x * alignScale;
      const drawY = pC7.y - imgShoulder_y * alignScale;

      ctx.drawImage(media, drawX, drawY, drawW, drawH);
    } else {
      // Standard centered fit
      const { x, y, w, h } = view;
      const imgAspect = natW / natH;
      const boxAspect = w / h;
      let drawW, drawH, drawX, drawY;
      if (boxAspect > imgAspect) {
        drawH = h;
        drawW = h * imgAspect;
        drawX = x + (w - drawW) / 2;
        drawY = y;
      } else {
        drawW = w;
        drawH = w / imgAspect;
        drawX = x;
        drawY = y + (h - drawH) / 2;
      }
      ctx.drawImage(media, drawX, drawY, drawW, drawH);
    }

    ctx.restore();
  }

  drawFrontGrid(ctx, project, width, height) {
    const extent = 180;
    const step = 40;
    ctx.save();
    ctx.lineWidth = 1;

    for (let xVal = -extent; xVal <= extent; xVal += step) {
      const alpha = xVal === 0 ? 0.18 : 0.06;
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      const a = project(v3(xVal, -10, 0));
      const b = project(v3(xVal, 90, 0));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (let yVal = 0; yVal <= 90; yVal += 20) {
      const alpha = yVal === 0 ? 0.25 : 0.06;
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      const a = project(v3(-extent, yVal, 0));
      const b = project(v3(extent, yVal, 0));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawGroundShadow(ctx, skel, project, scale) {
    const lightDir = vNorm(v3(0.32, -1.0, -0.62));
    const floorY = 0;
    const wallZ = -110;

    const castPoint = (pt) => {
      const tWall = (wallZ - pt.z) / lightDir.z;
      const hitWall = vAdd(pt, vScale(lightDir, tWall));
      if (hitWall.y < floorY) {
        const tFloor = (floorY - pt.y) / lightDir.y;
        return vAdd(pt, vScale(lightDir, tFloor));
      }
      return hitWall;
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.40)';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.30)';

    if (skel.headCenter && skel.headRadius) {
      const shCenter = project(castPoint(skel.headCenter));
      const shRadius = skel.headRadius * scale * 0.95;
      ctx.beginPath();
      ctx.arc(shCenter.x, shCenter.y, shRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    skel.segments.forEach(seg => {
      const a = project(castPoint(seg.from));
      const b = project(castPoint(seg.to));
      ctx.lineWidth = (seg.width || 5) * 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    ctx.restore();
  }

  drawHead(ctx, skel, project, scale) {
    const center = project(skel.headCenter);
    const radius = skel.headRadius * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Face / nose marker
    if (skel.nose) {
      const nose = project(skel.nose);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.9)';
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSegments(ctx, skel, project) {
    ctx.save();
    ctx.lineCap = 'round';

    skel.segments.forEach(seg => {
      const a = project(seg.from);
      const b = project(seg.to);
      const isRightArm = seg.id && seg.id.startsWith('right');

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = isRightArm ? (seg.width || 6) * 1.2 : (seg.width || 5);
      ctx.strokeStyle = isRightArm ? '#38bdf8' : (seg.color || '#94a3b8');

      if (isRightArm) {
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
    });

    ctx.restore();
  }

  drawJoints(ctx, skel, project) {
    const joints = [
      { id: 'pelvis', pt: skel.pelvis, r: 4 },
      { id: 'c7', pt: skel.c7, r: 4 },
      { id: 'c1', pt: skel.c1, r: 3 },
      { id: 'chin', pt: skel.chin, r: 3 },
      { id: 'rightShoulder', pt: skel.rightShoulder, r: 6, hot: true },
      { id: 'leftShoulder', pt: skel.leftShoulder, r: 4 },
      { id: 'rightElbow', pt: skel.rightElbow, r: 6, hot: true },
      { id: 'leftElbow', pt: skel.leftElbow, r: 4 },
      { id: 'rightWrist', pt: skel.rightWrist, r: 6, hot: true },
      { id: 'leftWrist', pt: skel.leftWrist, r: 4 }
    ];

    ctx.save();
    joints.forEach(j => {
      const pt = project(j.pt);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, j.r, 0, Math.PI * 2);
      ctx.fillStyle = j.hot ? '#0284c7' : '#475569';
      ctx.strokeStyle = j.hot ? '#e0f2fe' : '#cbd5e1';
      ctx.lineWidth = j.hot ? 2 : 1.5;
      if (j.hot) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  drawHandTipMarker(ctx, handTip, project, calib, media) {
    // Project handTip from calibrated image coordinate space
    if (!handTip || !media) return;
    const natW = media.videoWidth || media.naturalWidth || 640;
    const natH = media.videoHeight || media.naturalHeight || 480;
    const gridScaleX = natW / calib.grid_width;
    const gridScaleY = natH / calib.grid_height;

    const baseSkel = this.rig.computeSkeleton(this.rig.defaultState);
    const pC7 = project(baseSkel.c7);
    const pRightShoulder = project(baseSkel.rightShoulder);
    const pLeftShoulder = project(baseSkel.leftShoulder);
    const rigShoulderSpanPx = Math.hypot(pLeftShoulder.x - pRightShoulder.x, pLeftShoulder.y - pRightShoulder.y);

    const imgCenter_x = (calib.center_x !== undefined ? calib.center_x : 78.75) * gridScaleX;
    const calibShoulderY = (calib.shoulder_y && calib.shoulder_y <= 65) ? calib.shoulder_y : 58.75;
    const imgShoulder_y = calibShoulderY * gridScaleY;
    const skeletalHalfPx = (calib.skeletal_shoulder_half_px && calib.skeletal_shoulder_half_px <= 25) ? calib.skeletal_shoulder_half_px : 23.75;
    const imgShoulderSpanPx = skeletalHalfPx * 2 * gridScaleX;
    const alignScale = rigShoulderSpanPx / imgShoulderSpanPx;

    const screenX = pC7.x + (handTip[0] * gridScaleX - imgCenter_x) * alignScale;
    const screenY = pC7.y + (handTip[1] * gridScaleY - imgShoulder_y) * alignScale;

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
