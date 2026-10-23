/**
 * CKPE Front-View Canvas 2D Renderer.
 * Projects 3D biomechanical rig onto 2D canvas with calibrated video/image underlays
 * and optional multi-camera corner insets (Side, Top, and 3D Oblique).
 */

import { DEG, v3, vAdd, vScale, vDot, vCross, vNorm } from './math3d.js';

export function makeCamera(id, label, right, up, forward) {
  return {
    id,
    label,
    right: vNorm(right),
    up: vNorm(up),
    forward: vNorm(forward)
  };
}

export function createDefaultCameras() {
  const cameras = [
    makeCamera('front', 'FRONT', v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, -1)),
    makeCamera('side', 'SIDE', v3(0, 0, 1), v3(0, 1, 0), v3(-1, 0, 0)),
    makeCamera('top', 'TOP', v3(1, 0, 0), v3(0, 0, -1), v3(0, -1, 0))
  ];

  const isoYaw = 35 * DEG;
  const isoPitch = 22 * DEG;
  const isoPosition = vNorm(v3(
    Math.sin(isoYaw) * Math.cos(isoPitch),
    Math.sin(isoPitch),
    Math.cos(isoYaw) * Math.cos(isoPitch)
  ));
  const isoForward = vScale(isoPosition, -1);
  const isoRight = vNorm(vCross(isoForward, v3(0, 1, 0)));
  const isoUp = vNorm(vCross(isoRight, isoForward));
  cameras.push(makeCamera('iso', '3D OBLIQUE', isoRight, isoUp, isoForward));

  return cameras;
}

export class CKPERenderer {
  constructor(canvas, rig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rig = rig;
    this.dpr = window.devicePixelRatio || 1;
    this.cameras = createDefaultCameras();
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
    const { ctx, canvas, rig, dpr } = this;
    const width = (canvas.width / dpr) || 640;
    const height = (canvas.height / dpr) || 480;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const skel = rig.computeSkeleton(options.rigState);
    const displayMode = options.displayMode || 'overlay'; // 'overlay', 'rig', 'sample'

    // Anatomical Front View Framing:
    // Pelvis is at Y = 0, C7 at Y = 265, Head Crown at Y = 385.
    // Center Y at ~195 (mid-torso). Vertical span ~440 units, horizontal span ~360 units.
    const pad = 24;
    const spanX = 360;
    const spanY = 440;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const worldCenterX = 0;
    const worldCenterY = 195;
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;

    const project = (pt) => ({
      x: screenCenterX + (pt.x - worldCenterX) * scale,
      y: screenCenterY - (pt.y - worldCenterY) * scale,
      depth: pt.z
    });

    const view = { x: 0, y: 0, w: width, h: height };

    // 1. Draw Sample Underlay (if mode is 'overlay' or 'sample')
    if (displayMode !== 'rig' && options.underlay) {
      const alpha = displayMode === 'sample' ? 1.0 : (options.overlayAlpha !== undefined ? options.overlayAlpha : 0.50);
      this.drawUnderlay(ctx, options.underlay, view, project, options.calib, alpha);
    }

    // 2. Draw Front Grid (Floor & Wall) - Shadows removed per specification
    if (displayMode !== 'sample') {
      this.drawFrontGrid(ctx, project);
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

    // 4. Draw Corner Insets for Side, Top, and 3D Oblique Views
    if (options.showCornerViews) {
      this.drawCornerInsets(ctx, skel, width, height);
    }

    ctx.restore();
  }

  drawUnderlay(ctx, media, view, project, calib, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const natW = media.videoWidth || media.naturalWidth || 640;
    const natH = media.videoHeight || media.naturalHeight || 480;

    if (calib && calib.grid_width) {
      const gridScaleX = natW / calib.grid_width;
      const gridScaleY = natH / calib.grid_height;

      const baseSkel = this.rig.computeSkeleton(this.rig.defaultState);
      const pC7 = project(baseSkel.c7);
      const pRightShoulder = project(baseSkel.rightShoulder);
      const pLeftShoulder = project(baseSkel.leftShoulder);

      const rigShoulderSpanPx = Math.hypot(
        pLeftShoulder.x - pRightShoulder.x,
        pLeftShoulder.y - pRightShoulder.y
      );

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

  drawFrontGrid(ctx, project) {
    const extent = 260;
    const step = 52;
    ctx.save();
    ctx.lineWidth = 1;

    for (let xVal = -extent; xVal <= extent; xVal += step) {
      const alpha = xVal === 0 ? 0.20 : 0.07;
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      const a = project(v3(xVal, 0, 0));
      const b = project(v3(xVal, 480, 0));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (let yVal = 0; yVal <= 480; yVal += step) {
      const alpha = yVal === 0 ? 0.24 : 0.07;
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
    ctx.lineJoin = 'round';

    skel.segments.forEach(seg => {
      const a = project(seg.from);
      const b = project(seg.to);
      const isRightArm = seg.id && seg.id.startsWith('right');

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = isRightArm ? 6.5 : (seg.width || 5);
      ctx.strokeStyle = isRightArm ? '#38bdf8' : (seg.color || '#94a3b8');

      if (isRightArm) {
        ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
    });

    ctx.restore();
  }

  drawJoints(ctx, skel, project) {
    const joints = [
      { id: 'pelvis', pt: skel.pelvis, r: 5 },
      { id: 'c7', pt: skel.c7, r: 5 },
      { id: 'c1', pt: skel.c1, r: 4 },
      { id: 'chin', pt: skel.chin, r: 4 },
      { id: 'rightShoulder', pt: skel.rightShoulder, r: 6.5, hot: true },
      { id: 'leftShoulder', pt: skel.leftShoulder, r: 5 },
      { id: 'rightElbow', pt: skel.rightElbow, r: 6.5, hot: true },
      { id: 'leftElbow', pt: skel.leftElbow, r: 5 },
      { id: 'rightWrist', pt: skel.rightWrist, r: 6.5, hot: true },
      { id: 'leftWrist', pt: skel.leftWrist, r: 5 }
    ];

    ctx.save();
    joints.forEach(j => {
      const pt = project(j.pt);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, j.r, 0, Math.PI * 2);
      ctx.fillStyle = j.hot ? '#0284c7' : '#334155';
      ctx.strokeStyle = j.hot ? '#e0f2fe' : '#94a3b8';
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

  // --------------------------------------------------------------------------
  // Corner View Insets: Side, Top, and 3D Oblique
  // --------------------------------------------------------------------------
  drawCornerInsets(ctx, skel, canvasW, canvasH) {
    // Inset dimensions
    const pipW = Math.max(105, Math.min(150, Math.floor(canvasW * 0.22)));
    const pipH = Math.max(90, Math.min(130, Math.floor(canvasH * 0.25)));
    const pad = 12;

    const insets = [
      {
        camera: this.cameras[1], // SIDE
        x: canvasW - pipW - pad,
        y: pad,
        w: pipW,
        h: pipH
      },
      {
        camera: this.cameras[2], // TOP
        x: pad,
        y: canvasH - pipH - pad,
        w: pipW,
        h: pipH
      },
      {
        camera: this.cameras[3], // 3D OBLIQUE
        x: canvasW - pipW - pad,
        y: canvasH - pipH - pad,
        w: pipW,
        h: pipH
      }
    ];

    insets.forEach(inset => this.renderPIP(ctx, skel, inset));
  }

  renderPIP(ctx, skel, { camera, x, y, w, h }) {
    ctx.save();

    // 1. Inset background & border
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.clip();

    // 2. Compute local bounding box & projection scale
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    skel.segments.forEach(seg => {
      [seg.from, seg.to].forEach(pt => {
        const px = vDot(pt, camera.right);
        const py = vDot(pt, camera.up);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      });
    });

    if (skel.headCenter) {
      const r = skel.headRadius || 37.5;
      const px = vDot(skel.headCenter, camera.right);
      const py = vDot(skel.headCenter, camera.up);
      minX = Math.min(minX, px - r);
      maxX = Math.max(maxX, px + r);
      minY = Math.min(minY, py - r);
      maxY = Math.max(maxY, py + r);
    }

    const spanX = Math.max(maxX - minX, 100);
    const spanY = Math.max(maxY - minY, 100);
    const localPad = 12;
    const localScale = Math.min((w - localPad * 2) / spanX, (h - localPad * 2) / spanY);
    const worldCenterX = (minX + maxX) / 2;
    const worldCenterY = (minY + maxY) / 2;
    const viewCenterX = x + w / 2;
    const viewCenterY = y + h / 2 + 5;

    const pipProject = (pt) => ({
      x: viewCenterX + (vDot(pt, camera.right) - worldCenterX) * localScale,
      y: viewCenterY - (vDot(pt, camera.up) - worldCenterY) * localScale,
      depth: vDot(pt, camera.forward)
    });

    // 3. Draw miniature reference grid
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    const gridStep = 45;
    for (let g = -180; g <= 180; g += gridStep) {
      const ga = pipProject(camera.id === 'top' ? v3(g, 0, -180) : v3(0, 0, g));
      const gb = pipProject(camera.id === 'top' ? v3(g, 0, 180) : v3(0, 360, g));
      ctx.beginPath();
      ctx.moveTo(ga.x, ga.y);
      ctx.lineTo(gb.x, gb.y);
      ctx.stroke();
    }

    // 4. Draw Segments
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    skel.segments.forEach(seg => {
      const a = pipProject(seg.from);
      const b = pipProject(seg.to);
      const isRightArm = seg.id && seg.id.startsWith('right');

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = isRightArm ? 3.5 : 2.5;
      ctx.strokeStyle = isRightArm ? '#38bdf8' : (seg.color || '#64748b');
      ctx.stroke();
    });

    // 5. Draw Head
    if (skel.headCenter) {
      const center = pipProject(skel.headCenter);
      const radius = skel.headRadius * localScale;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // 6. Draw Joint dots
    const joints = [skel.pelvis, skel.c7, skel.rightShoulder, skel.leftShoulder, skel.rightElbow, skel.leftElbow, skel.rightWrist, skel.leftWrist];
    joints.forEach((pt, idx) => {
      const s = pipProject(pt);
      ctx.beginPath();
      ctx.arc(s.x, s.y, idx >= 2 && idx % 2 === 0 ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = idx >= 2 && idx % 2 === 0 ? '#38bdf8' : '#94a3b8';
      ctx.fill();
    });

    // 7. Draw camera label pill
    ctx.restore();
    ctx.save();
    ctx.font = '700 9px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    const labelW = ctx.measureText(camera.label).width + 8;
    ctx.fillRect(x + 5, y + 5, labelW, 14);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 5, y + 5, labelW, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(camera.label, x + 9, y + 15);
    ctx.restore();
  }
}
