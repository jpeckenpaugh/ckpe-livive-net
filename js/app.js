/**
 * CKPE Single Page Application (SPA)
 * Controller for Index, Detail, and Provenance views.
 */

import { Rig3D } from './rig.js';
import { CKPERenderer } from './renderer.js';

class CKPEApp {
  constructor() {
    this.rigSpec = null;
    this.catalog = [];
    this.filteredCatalog = [];
    this.cachedTerms = new Map();
    this.currentTermData = null;
    this.currentFrameIdx = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.displayMode = 'overlay'; // 'overlay', 'rig', 'sample'
    this.showCornerViews = false;
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.rafId = null;
    this.lastFrameTime = 0;
    this.builderSteps = [];

    // DOM Elements
    this.views = {
      index: document.getElementById('view-index'),
      detail: document.getElementById('view-detail'),
      speech: document.getElementById('view-speech'),
      provenance: document.getElementById('view-provenance')
    };

    this.navBtns = {
      index: document.getElementById('nav-index'),
      detail: document.getElementById('nav-detail'),
      speech: document.getElementById('nav-speech'),
      provenance: document.getElementById('nav-provenance')
    };

    // Index DOM
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.filterPills = document.getElementById('filterPills');
    this.termGrid = document.getElementById('termGrid');
    this.catalogStatus = document.getElementById('catalogStatus');

    // Detail DOM
    this.detailVideo = document.getElementById('detailVideo');
    this.detailCanvas = document.getElementById('detailCanvas');
    this.detailTermName = document.getElementById('detailTermName');
    this.detailSourceBadge = document.getElementById('detailSourceBadge');
    this.rewardBadge = document.getElementById('rewardBadge');
    this.frameSlider = document.getElementById('frameSlider');
    this.phasePrepSeg = document.getElementById('phasePrepSeg');
    this.phaseStrokeSeg = document.getElementById('phaseStrokeSeg');
    this.phaseRetractSeg = document.getElementById('phaseRetractSeg');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.stepPrevBtn = document.getElementById('stepPrevBtn');
    this.stepNextBtn = document.getElementById('stepNextBtn');
    this.speedToggleBtn = document.getElementById('speedToggleBtn');
    this.currentFrameNum = document.getElementById('currentFrameNum');
    this.totalFramesNum = document.getElementById('totalFramesNum');
    this.currentFrameMs = document.getElementById('currentFrameMs');
    this.currentPhaseLabel = document.getElementById('currentPhaseLabel');
    this.jointTableBody = document.getElementById('jointTableBody');
    this.authoredSpecCard = document.getElementById('authoredSpecCard');
    this.authoredSpecText = document.getElementById('authoredSpecText');
    this.prevTermBtn = document.getElementById('prevTermBtn');
    this.nextTermBtn = document.getElementById('nextTermBtn');
    this.toggleCornerViewsBtn = document.getElementById('toggleCornerViewsBtn');

    // Chain Builder Modal DOM
    this.chainBuilderModal = document.getElementById('chainBuilderModal');
    this.openChainBuilderBtn = document.getElementById('openChainBuilderBtn');
    this.closeChainModalBtn = document.getElementById('closeChainModalBtn');
    this.cancelChainModalBtn = document.getElementById('cancelChainModalBtn');
    this.compileChainBtn = document.getElementById('compileChainBtn');
    this.addStepBtn = document.getElementById('addStepBtn');
    this.chainNameInput = document.getElementById('chainNameInput');
    this.chainStepsList = document.getElementById('chainStepsList');

    // Detail Metadata DOM
    this.metaSource = document.getElementById('metaSource');
    this.metaReference = document.getElementById('metaReference');
    this.metaMeanReward = document.getElementById('metaMeanReward');
    this.metaDuration = document.getElementById('metaDuration');
    this.metaPhaseSplit = document.getElementById('metaPhaseSplit');
    this.metaLocation = document.getElementById('metaLocation');
    this.metaMovement = document.getElementById('metaMovement');

    // Speech-to-Sign DOM
    this.micBtn = document.getElementById('micBtn');
    this.micLabel = document.getElementById('micLabel');
    this.speechTextInput = document.getElementById('speechTextInput');
    this.speechClearBtn = document.getElementById('speechClearBtn');
    this.speechAutocomplete = document.getElementById('speechAutocomplete');
    this.speechPlayBtn = document.getElementById('speechPlayBtn');
    this.speechStatusBanner = document.getElementById('speechStatusBanner');
    this.speechStatusText = document.getElementById('speechStatusText');
    this.speechSentenceRow = document.getElementById('speechSentenceRow');
    this.speechChipsContainer = document.getElementById('speechChipsContainer');
    this.speechCanvas = document.getElementById('speechCanvas');
    this.speechActiveWordBadge = document.getElementById('speechActiveWordBadge');
    this.speechCornerViewsBtn = document.getElementById('speechCornerViewsBtn');
    this.speechReplayBtn = document.getElementById('speechReplayBtn');
    this.speechPauseBtn = document.getElementById('speechPauseBtn');
    this.speechProgressText = document.getElementById('speechProgressText');
    this.speechInspectBtn = document.getElementById('speechInspectBtn');
    this.speechCardTitle = document.getElementById('speechCardTitle');
    this.speechCardBadge = document.getElementById('speechCardBadge');
    this.speechCardDesc = document.getElementById('speechCardDesc');
    this.speechMetaTerm = document.getElementById('speechMetaTerm');
    this.speechMetaPhonology = document.getElementById('speechMetaPhonology');
    this.speechMetaFrames = document.getElementById('speechMetaFrames');

    // Speech-to-Sign Video & Overlay DOM
    this.speechVideo = document.getElementById('speechVideo');
    this.speechModeToggles = document.getElementById('speechModeToggles');
    this.speechDisplayMode = 'overlay'; // 'overlay', 'rig', 'sample'

    if (this.speechVideo) {
      this.speechVideo.onloadeddata = () => {
        if (!this.speechIsPlaying) this.renderSpeechCurrentFrame();
      };
      this.speechVideo.onseeked = () => {
        if (!this.speechIsPlaying) this.renderSpeechCurrentFrame();
      };
    }

    // Speech state
    this.speechRecognition = null;
    this.isListening = false;
    this.speechRafId = null;
    this.speechIsPlaying = false;
    this.speechFrames = [];
    this.speechFrameIdx = 0;
    this.speechLastFrameTime = 0;
    this.speechCurrentTerms = [];
  }

  async init() {
    try {
      // 1. Fetch Rig Specification
      const specRes = await fetch('data/rig-spec.json');
      this.rigSpec = await specRes.json();
      this.rig = new Rig3D(this.rigSpec);
      this.renderer = new CKPERenderer(this.detailCanvas, this.rig);
      if (this.speechCanvas) {
        this.speechRenderer = new CKPERenderer(this.speechCanvas, this.rig);
      }

      // 2. Fetch Catalog Index
      const indexRes = await fetch('data/index.json');
      this.catalog = await indexRes.json();
      this.filteredCatalog = [...this.catalog];

      // Update count indicators
      const learnedCount = this.catalog.filter(t => t.source === 'learned').length;
      const authoredCount = this.catalog.filter(t => t.source === 'authored').length;
      document.getElementById('count-all').textContent = this.catalog.length;
      document.getElementById('count-learned').textContent = learnedCount;
      document.getElementById('count-authored').textContent = authoredCount;

      // 3. Setup Events, Speech View, & Routing
      this.bindEvents();
      this.initSpeechView();
      this.renderIndexGrid();
      this.handleHashChange();

      window.addEventListener('hashchange', () => this.handleHashChange());
      window.addEventListener('resize', () => {
        this.renderer.resize();
        if (this.currentTermData) this.renderCurrentFrame();
        if (this.speechRenderer) {
          this.speechRenderer.resize();
          this.renderSpeechCurrentFrame();
        }
      });

      console.log('CKPE SPA initialized with', this.catalog.length, 'terms.');
    } catch (err) {
      console.error('Initialization failed:', err);
      if (this.catalogStatus) {
        this.catalogStatus.textContent = 'Error loading dataset: ' + err.message;
        this.catalogStatus.style.color = '#ef4444';
      }
    }
  }

  bindEvents() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.applyFilters();
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.clearSearchBtn.style.display = 'none';
      this.applyFilters();
      this.searchInput.focus();
    });

    // Filter pills
    this.filterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      this.filterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.activeFilter = btn.dataset.filter;
      this.applyFilters();
    });

    // Scrubber slider
    this.frameSlider.addEventListener('input', (e) => {
      if (this.isPlaying) this.pause();
      this.seekToFrame(parseInt(e.target.value, 10));
    });

    // Play/Pause & Step Controls
    this.playPauseBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    });

    this.stepPrevBtn.addEventListener('click', () => {
      if (this.isPlaying) this.pause();
      const prev = Math.max(0, this.currentFrameIdx - 1);
      this.seekToFrame(prev);
    });

    this.stepNextBtn.addEventListener('click', () => {
      if (this.isPlaying) this.pause();
      const total = this.currentTermData ? this.currentTermData.frames.length : 1;
      const next = (this.currentFrameIdx + 1) % total;
      this.seekToFrame(next);
    });

    // Speed toggle
    this.speedToggleBtn.addEventListener('click', () => {
      if (this.playbackSpeed === 1.0) {
        this.playbackSpeed = 0.5;
        this.speedToggleBtn.textContent = '0.5×';
      } else {
        this.playbackSpeed = 1.0;
        this.speedToggleBtn.textContent = '1.0×';
      }
    });

    // Detail Overlay mode toggles
    const detailModeButtons = document.querySelectorAll('#detailModeToggles button[data-mode]');
    detailModeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        detailModeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.displayMode = btn.dataset.mode;
        this.renderCurrentFrame();
      });
    });

    // Corner views toggle
    if (this.toggleCornerViewsBtn) {
      this.toggleCornerViewsBtn.addEventListener('click', () => {
        this.showCornerViews = !this.showCornerViews;
        this.toggleCornerViewsBtn.classList.toggle('active', this.showCornerViews);
        this.renderCurrentFrame();
      });
    }

    // Movement Chain Builder triggers
    if (this.openChainBuilderBtn) {
      this.openChainBuilderBtn.addEventListener('click', () => this.openChainModal('you-me-right-agree'));
    }
    if (this.closeChainModalBtn) {
      this.closeChainModalBtn.addEventListener('click', () => this.closeChainModal());
    }
    if (this.cancelChainModalBtn) {
      this.cancelChainModalBtn.addEventListener('click', () => this.closeChainModal());
    }
    if (this.chainBuilderModal) {
      this.chainBuilderModal.addEventListener('click', (e) => {
        if (e.target === this.chainBuilderModal) this.closeChainModal();
      });
    }
    if (this.addStepBtn) {
      this.addStepBtn.addEventListener('click', () => {
        this.addChainStep('point-you', '');
      });
    }
    if (this.compileChainBtn) {
      this.compileChainBtn.addEventListener('click', () => this.compileAndPreviewChain());
    }

    const templatePills = document.querySelectorAll('.template-pill');
    templatePills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.loadTemplateSteps(pill.dataset.template);
      });
    });

    // Pagination
    this.prevTermBtn.addEventListener('click', () => this.navigateAdjacentTerm(-1));
    this.nextTermBtn.addEventListener('click', () => this.navigateAdjacentTerm(1));
  }

  // --------------------------------------------------------------------------
  // Routing & View Switching
  // --------------------------------------------------------------------------
  handleHashChange() {
    const hash = window.location.hash || '#/index';

    // Highlight active nav
    Object.values(this.navBtns).forEach(btn => btn.classList.remove('active'));

    if (hash.startsWith('#/detail')) {
      if (this.speechIsPlaying) this.pauseSpeechLoop();
      this.switchView('detail');
      this.navBtns.detail.classList.add('active');
      const parts = hash.split('/');
      const termName = parts[2];
      if (termName) {
        this.loadTerm(termName);
      } else if (this.catalog.length > 0) {
        // default to first term
        const defaultTerm = this.currentTermData ? this.currentTermData.term : this.catalog[0].term;
        window.location.hash = `#/detail/${defaultTerm}`;
      }
    } else if (hash.startsWith('#/speech')) {
      if (this.isPlaying) this.pause();
      this.switchView('speech');
      this.navBtns.speech.classList.add('active');
    } else if (hash.startsWith('#/provenance')) {
      if (this.isPlaying) this.pause();
      if (this.speechIsPlaying) this.pauseSpeechLoop();
      this.switchView('provenance');
      this.navBtns.provenance.classList.add('active');
    } else {
      if (this.isPlaying) this.pause();
      if (this.speechIsPlaying) this.pauseSpeechLoop();
      this.switchView('index');
      this.navBtns.index.classList.add('active');
    }
  }

  switchView(viewName) {
    Object.entries(this.views).forEach(([name, el]) => {
      el.style.display = (name === viewName) ? 'block' : 'none';
    });
    window.scrollTo(0, 0);

    if (viewName === 'detail' && this.renderer) {
      requestAnimationFrame(() => {
        this.renderer.resize();
        if (this.currentTermData) {
          this.renderCurrentFrame();
        }
      });
    }

    if (viewName === 'speech' && this.speechRenderer) {
      requestAnimationFrame(() => {
        this.speechRenderer.resize();
        this.renderSpeechCurrentFrame();
      });
    }
  }

  // --------------------------------------------------------------------------
  // Index View Logic
  // --------------------------------------------------------------------------
  applyFilters() {
    const q = this.searchQuery;
    const filter = this.activeFilter;

    this.filteredCatalog = this.catalog.filter(term => {
      // Text search
      if (q) {
        const titleMatch = term.label.toLowerCase().includes(q) || term.term.toLowerCase().includes(q);
        const locMajor = (term.location && term.location.major) ? term.location.major.toLowerCase() : '';
        const locMinor = (term.location && term.location.minor) ? term.location.minor.toLowerCase() : '';
        const movMatch = (term.movement || '').toLowerCase().includes(q);
        const handMatch = (term.handshape || '').toLowerCase().includes(q);
        if (!titleMatch && !locMajor.includes(q) && !locMinor.includes(q) && !movMatch && !handMatch) {
          return false;
        }
      }

      // Filter pills
      if (filter === 'learned') return term.source === 'learned';
      if (filter === 'authored') return term.source === 'authored';
      if (filter === 'loc-head') return term.location && term.location.major && term.location.major.toLowerCase().includes('head');
      if (filter === 'loc-chest') return term.location && term.location.major && (term.location.major.toLowerCase().includes('chest') || term.location.major.toLowerCase().includes('body') || term.location.major.toLowerCase().includes('arm'));
      if (filter === 'loc-neutral') return term.location && term.location.major && term.location.major.toLowerCase().includes('neutral');

      return true;
    });

    this.renderIndexGrid();
  }

  renderIndexGrid() {
    const count = this.filteredCatalog.length;
    this.catalogStatus.textContent = `Showing ${count} ${count === 1 ? 'sequence' : 'sequences'}`;

    if (count === 0) {
      this.termGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">
          No matching gestures found. Try clearing your search query or filter.
        </div>
      `;
      return;
    }

    this.termGrid.innerHTML = this.filteredCatalog.map(item => {
      const isLearned = item.source === 'learned';
      const badgeClass = isLearned ? 'badge-learned' : 'badge-authored';
      const badgeText = item.source;
      const locText = item.location && item.location.major ? item.location.major : 'Neutral';
      const movText = item.movement ? ` • ${item.movement}` : '';
      const handText = item.handshape ? ` • ${item.handshape}` : '';
      const fitText = isLearned && item.mean_reward ? `Fit: ${(item.mean_reward * 100).toFixed(0)}%` : `${item.frame_count} frames`;

      const thumbHtml = item.thumbnail
        ? `<img class="card-thumb" src="${item.thumbnail}" alt="${item.label}" loading="lazy">`
        : `<div class="card-thumb-placeholder">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="12" cy="7" r="4"/>
               <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/>
             </svg>
             <span>Kinematic Spec</span>
           </div>`;

      return `
        <a href="#/detail/${item.term}" class="term-card">
          <div class="card-thumb-wrap">
            ${thumbHtml}
          </div>
          <div class="card-body">
            <div class="card-header-row">
              <span class="card-title">${item.label}</span>
              <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="card-meta-line" title="${locText}${movText}${handText}">
              ${locText}${movText}${handText}
            </div>
            <div class="card-footer-row">
              <span class="card-reward-chip">${fitText}</span>
              <span>${item.duration_ms}ms</span>
            </div>
          </div>
        </a>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // Detail View Logic
  // --------------------------------------------------------------------------
  async loadTerm(termName) {
    if (this.currentTermData && this.currentTermData.term === termName) {
      return;
    }

    this.detailTermName.textContent = 'Loading ' + termName + '...';

    try {
      let data = this.cachedTerms.get(termName);
      if (!data) {
        const res = await fetch(`data/terms/${termName}.json`);
        if (!res.ok) throw new Error(`Could not load term data for ${termName}`);
        data = await res.json();
        this.cachedTerms.set(termName, data);
      }

      this.currentTermData = data;
      this.currentFrameIdx = 0;

      // Populate Detail Header
      this.detailTermName.textContent = data.label || data.term.replace('_', ' ').toUpperCase();
      this.detailSourceBadge.className = `badge ${data.source === 'learned' ? 'badge-learned' : 'badge-authored'}`;
      this.detailSourceBadge.textContent = data.source;

      // Authored Spec card
      if (data.source === 'authored' && data.authored_spec) {
        this.authoredSpecCard.style.display = 'block';
        this.authoredSpecText.textContent = data.authored_spec;
      } else {
        this.authoredSpecCard.style.display = 'none';
      }

      // Metadata block
      this.metaSource.innerHTML = `<span class="badge ${data.source === 'learned' ? 'badge-learned' : 'badge-authored'}">${data.source}</span>`;
      if (data.source_url) {
        this.metaReference.innerHTML = `<a href="${data.source_url}" target="_blank" rel="noopener">${data.code || 'ASL-LEX'} ↗</a>`;
      } else {
        this.metaReference.textContent = data.code || 'Authored Specification';
      }

      this.metaMeanReward.textContent = data.mean_reward ? `${(data.mean_reward * 100).toFixed(1)}% mean silhouette overlap` : 'N/A (Authored spec)';
      this.metaDuration.textContent = `${data.duration_ms} ms (${data.frame_count} frames)`;

      if (data.phase_split) {
        this.metaPhaseSplit.textContent = `Prep: ${data.phase_split.prep || 0}f • Stroke: ${data.phase_split.stroke || 0}f • Retract: ${data.phase_split.retract || 0}f`;
      } else {
        this.metaPhaseSplit.textContent = 'Unified stroke';
      }

      const major = (data.location && data.location.major) || 'Neutral';
      const minor = (data.location && data.location.minor) ? ` (${data.location.minor})` : '';
      this.metaLocation.textContent = `${major}${minor}`;
      this.metaMovement.textContent = `${data.movement || 'Unspecified'} • ${data.handshape || 'Default'}`;

      // Video element setup for learned signs
      if (data.video && data.source === 'learned') {
        this.detailVideo.src = data.video;
        this.detailVideo.load();
        this.detailVideo.onloadeddata = () => {
          this.renderCurrentFrame();
        };
      } else {
        this.detailVideo.removeAttribute('src');
      }

      // Slider & Phase Tracks
      const totalFrames = data.frames.length;
      this.frameSlider.min = 0;
      this.frameSlider.max = Math.max(0, totalFrames - 1);
      this.frameSlider.value = 0;
      this.totalFramesNum.textContent = totalFrames;

      this.updatePhaseTrackLayout(data);

      // Render first frame
      this.renderer.resize();
      this.seekToFrame(0);
    } catch (err) {
      console.error('Failed to load term:', err);
      this.detailTermName.textContent = 'Error loading term';
    }
  }

  updatePhaseTrackLayout(termData) {
    const total = termData.frames.length || 1;
    let prepCount = 0, strokeCount = 0, retractCount = 0;

    termData.frames.forEach(f => {
      const p = (f.phase || 'stroke').toLowerCase();
      if (p === 'prep') prepCount++;
      else if (p === 'retract') retractCount++;
      else strokeCount++;
    });

    const prepPct = (prepCount / total) * 100;
    const strokePct = (strokeCount / total) * 100;
    const retractPct = (retractCount / total) * 100;

    this.phasePrepSeg.style.width = `${prepPct}%`;
    this.phaseStrokeSeg.style.width = `${strokePct}%`;
    this.phaseRetractSeg.style.width = `${retractPct}%`;
  }

  seekToFrame(frameIndex) {
    if (!this.currentTermData || !this.currentTermData.frames) return;
    const frames = this.currentTermData.frames;
    if (frameIndex < 0 || frameIndex >= frames.length) return;

    this.currentFrameIdx = frameIndex;
    this.frameSlider.value = frameIndex;

    const frame = frames[frameIndex];

    // Sync video timestamp if present
    if (this.detailVideo && this.currentTermData.source === 'learned' && frame.timestamp_s !== undefined) {
      if (Math.abs(this.detailVideo.currentTime - frame.timestamp_s) > 0.01) {
        this.detailVideo.currentTime = frame.timestamp_s;
      }
    }

    // Update scrubber text
    this.currentFrameNum.textContent = frameIndex + 1;
    this.currentFrameMs.textContent = frame.timestamp_ms || 0;
    this.currentPhaseLabel.textContent = frame.phase || 'stroke';

    // Reward badge update
    if (this.currentTermData.source === 'authored') {
      this.rewardBadge.className = 'reward-badge badge-authored-spec';
      this.rewardBadge.textContent = 'Authored Specification';
    } else {
      const rew = frame.reward !== undefined ? frame.reward : 0;
      this.rewardBadge.className = 'reward-badge';
      this.rewardBadge.textContent = `Reward: ${(rew * 100).toFixed(1)}%`;
      if (rew >= 0.80) {
        this.rewardBadge.style.color = '#34d399';
      } else if (rew >= 0.60) {
        this.rewardBadge.style.color = '#fbbf24';
      } else {
        this.rewardBadge.style.color = '#f87171';
      }
    }

    // Render Joint Readout Table with Deltas
    this.renderJointStateTable(frame);

    // Canvas render
    this.renderCurrentFrame();
  }

  renderJointStateTable(currentFrame) {
    if (!this.currentTermData) return;
    const currentState = currentFrame.rig_state || {};
    const prevIdx = Math.max(0, this.currentFrameIdx - 1);
    const prevState = this.currentTermData.frames[prevIdx].rig_state || {};

    const jointDefs = [
      { key: 'rightShoulderAngle', label: 'R Shoulder Abduction', arm: true },
      { key: 'rightShoulderFlexion', label: 'R Shoulder Flexion', arm: true },
      { key: 'rightShoulderRotation', label: 'R Humeral Rotation', arm: true },
      { key: 'rightElbowBend', label: 'R Elbow Flexion', arm: true },
      { key: 'headPitch', label: 'Head Pitch (C1)' },
      { key: 'neckYaw', label: 'Neck Yaw (C7)' },
      { key: 'neckRoll', label: 'Neck Roll (C7)' },
      { key: 'shoulderElevation', label: 'Shoulder Elevation' },
      { key: 'shoulderTilt', label: 'Shoulder Tilt' },
      { key: 'leftShoulderAngle', label: 'L Shoulder Abduction' },
      { key: 'leftShoulderFlexion', label: 'L Shoulder Flexion' },
      { key: 'leftShoulderRotation', label: 'L Humeral Rotation' },
      { key: 'leftElbowBend', label: 'L Elbow Flexion' },
      { key: 'pelvisTwist', label: 'Pelvis Twist' },
      { key: 'pelvisBow', label: 'Pelvis Bow' }
    ];

    this.jointTableBody.innerHTML = jointDefs.map(j => {
      const val = currentState[j.key] !== undefined ? currentState[j.key] : 0;
      const prevVal = prevState[j.key] !== undefined ? prevState[j.key] : val;
      const delta = Math.abs(val - prevVal);
      const sign = (val - prevVal) >= 0 ? '+' : '−';
      const deltaStr = (val === prevVal || this.currentFrameIdx === 0) ? '0.0°' : `${sign}${delta.toFixed(1)}°`;
      const isOk = delta <= 12.0;

      return `
        <tr class="${j.arm ? 'highlight-arm' : ''}">
          <td>${j.label}</td>
          <td class="joint-val">${val.toFixed(1)}&deg;</td>
          <td>
            <span class="delta-pill ${isOk ? 'delta-ok' : 'delta-warn'}">${deltaStr}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderCurrentFrame() {
    if (!this.currentTermData || !this.renderer) return;
    const frame = this.currentTermData.frames[this.currentFrameIdx];
    if (!frame) return;

    const underlaySource = (this.currentTermData.source === 'learned' && this.detailVideo.readyState >= 1)
      ? this.detailVideo
      : null;

    this.renderer.render({
      rigState: frame.rig_state,
      displayMode: this.displayMode,
      underlay: underlaySource,
      calib: this.currentTermData.calibration,
      rightHandTip: frame.rightHandTip,
      overlayAlpha: 0.50,
      showCornerViews: this.showCornerViews
    });
  }

  // --------------------------------------------------------------------------
  // Playback Loop
  // --------------------------------------------------------------------------
  play() {
    if (!this.currentTermData) return;
    this.isPlaying = true;
    this.playPauseBtn.textContent = 'Pause';
    this.playPauseBtn.classList.add('playing');
    this.lastFrameTime = performance.now();

    const loop = (now) => {
      if (!this.isPlaying) return;

      const elapsed = now - this.lastFrameTime;
      const targetInterval = (33.33 / this.playbackSpeed);

      if (elapsed >= targetInterval) {
        this.lastFrameTime = now;
        const total = this.currentTermData.frames.length;
        const next = (this.currentFrameIdx + 1) % total;
        this.seekToFrame(next);
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  pause() {
    this.isPlaying = false;
    this.playPauseBtn.textContent = 'Play';
    this.playPauseBtn.classList.remove('playing');
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  navigateAdjacentTerm(direction) {
    if (!this.currentTermData || this.catalog.length === 0) return;
    const currentTerm = this.currentTermData.term;
    const idx = this.catalog.findIndex(t => t.term === currentTerm);
    if (idx === -1) return;

    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = this.catalog.length - 1;
    if (nextIdx >= this.catalog.length) nextIdx = 0;

    const nextTerm = this.catalog[nextIdx].term;
    window.location.hash = `#/detail/${nextTerm}`;
  }

  // --------------------------------------------------------------------------
  // Movement Chain Builder Engine
  // --------------------------------------------------------------------------
  openChainModal(templateName = 'you-me-right-agree') {
    if (this.isPlaying) this.pause();
    this.chainBuilderModal.style.display = 'flex';
    this.loadTemplateSteps(templateName);
    this.chainNameInput.focus();
  }

  closeChainModal() {
    this.chainBuilderModal.style.display = 'none';
  }

  loadTemplateSteps(templateId) {
    if (templateId === 'you-me-right-agree') {
      this.chainNameInput.value = 'Chain: You → Me → Right → Agree';
      this.builderSteps = [
        { primary: 'reset', blend: '', duration: 0.8 },
        { primary: 'point-you', blend: '', duration: 0.8 },
        { primary: 'point-me', blend: '', duration: 0.8 },
        { primary: 'point-right', blend: 'agree', duration: 1.0 }
      ];
    } else if (templateId === 'you-me-left-disagree') {
      this.chainNameInput.value = 'Chain: You → Me → Left + Disagree';
      this.builderSteps = [
        { primary: 'reset', blend: '', duration: 0.8 },
        { primary: 'point-you', blend: '', duration: 0.8 },
        { primary: 'point-me', blend: '', duration: 0.8 },
        { primary: 'point-left', blend: 'disagree', duration: 1.0 }
      ];
    } else if (templateId === 'handsup-reset-hats') {
      this.chainNameInput.value = 'Chain: Hands Up → Rest → Hats Off';
      this.builderSteps = [
        { primary: 'reset', blend: '', duration: 0.8 },
        { primary: 'hands-up', blend: '', duration: 1.0 },
        { primary: 'reset', blend: '', duration: 0.8 },
        { primary: 'hats-off', blend: '', duration: 1.0 }
      ];
    } else {
      this.chainNameInput.value = 'Custom Sequence';
      this.builderSteps = [
        { primary: 'reset', blend: '', duration: 0.8 },
        { primary: 'point-you', blend: '', duration: 0.8 }
      ];
    }
    this.renderChainStepsList();
  }

  addChainStep(primary = 'point-you', blend = '') {
    this.builderSteps.push({ primary, blend, duration: 0.8 });
    this.renderChainStepsList();
  }

  removeChainStep(idx) {
    if (this.builderSteps.length <= 1) return;
    this.builderSteps.splice(idx, 1);
    this.renderChainStepsList();
  }

  renderChainStepsList() {
    const actions = [
      { id: 'reset', label: 'Rest / Reset (Neutral)' },
      { id: 'point-you', label: 'Point You (Forward)' },
      { id: 'point-me', label: 'Point Me (Chest)' },
      { id: 'point-right', label: 'Point Right (Lateral)' },
      { id: 'point-left', label: 'Point Left (Cross-Body)' },
      { id: 'point-it', label: 'Point It (Forward Lateral)' },
      { id: 'agree', label: 'Agree (Head Nod Yes)' },
      { id: 'disagree', label: 'Disagree (Head Shake No)' },
      { id: 'hands-up', label: 'Hands Up (Bilateral)' },
      { id: 'hats-off', label: 'Hats Off (Salute/Tip)' }
    ];

    const blends = [
      { id: '', label: 'No Simultaneous Head Action' },
      { id: 'agree', label: '+ Nod Head (Agree)' },
      { id: 'disagree', label: '+ Shake Head (Disagree)' }
    ];

    this.chainStepsList.innerHTML = this.builderSteps.map((step, idx) => {
      const actionOptions = actions.map(a =>
        `<option value="${a.id}" ${a.id === step.primary ? 'selected' : ''}>${a.label}</option>`
      ).join('');

      const blendOptions = blends.map(b =>
        `<option value="${b.id}" ${b.id === step.blend ? 'selected' : ''}>${b.label}</option>`
      ).join('');

      return `
        <div class="step-row" data-index="${idx}">
          <span class="step-num-pill">${idx + 1}</span>
          <select class="step-select" data-field="primary">
            ${actionOptions}
          </select>
          <select class="step-blend-select" data-field="blend">
            ${blendOptions}
          </select>
          <button class="step-remove-btn" title="Remove Step" ${this.builderSteps.length <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>&times;</button>
        </div>
      `;
    }).join('');

    const rows = this.chainStepsList.querySelectorAll('.step-row');
    rows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const primSelect = row.querySelector('.step-select');
      const blendSelect = row.querySelector('.step-blend-select');
      const removeBtn = row.querySelector('.step-remove-btn');

      primSelect.addEventListener('change', (e) => {
        this.builderSteps[idx].primary = e.target.value;
      });
      blendSelect.addEventListener('change', (e) => {
        this.builderSteps[idx].blend = e.target.value;
      });
      removeBtn.addEventListener('click', () => {
        this.removeChainStep(idx);
      });
    });
  }

  compileAndPreviewChain() {
    const rawName = this.chainNameInput.value.trim() || 'Custom Sequence';
    const chainId = 'custom-' + Date.now().toString(36);

    const actionsDB = {
      'reset': { targets: { ...this.rig.defaultState } },
      'point-you': { targets: { rightShoulderFlexion: 60, rightShoulderRotation: 0, rightShoulderAngle: -2, rightElbowBend: 40 } },
      'point-me': { targets: { rightShoulderAngle: 20, rightShoulderFlexion: 60, rightShoulderRotation: -110, rightElbowBend: 130 } },
      'point-right': { targets: { rightShoulderAngle: -60, rightShoulderFlexion: 0, rightShoulderRotation: 70, rightElbowBend: 50 } },
      'point-left': { targets: { rightShoulderAngle: 45, rightShoulderFlexion: 45, rightShoulderRotation: -90, rightElbowBend: 50 } },
      'point-it': { targets: { rightShoulderFlexion: 60, rightShoulderRotation: 50, rightShoulderAngle: -2, rightElbowBend: 40 } },
      'hands-up': { targets: { shoulderElevation: 10, rightShoulderAngle: 8, rightShoulderFlexion: 150, rightShoulderRotation: -60, leftShoulderAngle: -8, leftShoulderFlexion: 150, leftShoulderRotation: -60, rightElbowBend: 20, leftElbowBend: 20 } },
      'hats-off': { targets: { rightShoulderAngle: -15, rightShoulderFlexion: 115, rightShoulderRotation: 30, rightElbowBend: 110 } },
      'agree': { sine: { stateKey: 'headPitch', amplitude: 20, cycles: 2 } },
      'disagree': { sine: { stateKey: 'neckYaw', amplitude: 40, cycles: 2 } }
    };

    const fps = 30;
    const stepDurationS = 0.85;
    const framesPerStep = Math.round(fps * stepDurationS);
    const steps = this.builderSteps;
    const totalFrames = steps.length * framesPerStep;
    const totalDurationMs = Math.round(steps.length * stepDurationS * 1000);

    const frames = [];
    let currentState = { ...this.rig.defaultState };

    steps.forEach((step, stepIdx) => {
      const startState = { ...currentState };
      const primAct = actionsDB[step.primary] || {};
      const blendAct = step.blend ? actionsDB[step.blend] : null;

      const stepTargets = { ...(primAct.targets || {}) };
      const stepSines = [];
      if (primAct.sine) stepSines.push(primAct.sine);
      if (blendAct && blendAct.sine) stepSines.push(blendAct.sine);
      if (blendAct && blendAct.targets) Object.assign(stepTargets, blendAct.targets);

      for (let fIdx = 0; fIdx < framesPerStep; fIdx++) {
        const globalIdx = frames.length;
        const tNorm = fIdx / Math.max(framesPerStep - 1, 1);
        const ease = 0.5 - 0.5 * Math.cos(tNorm * Math.PI);
        const tsMs = Math.round((globalIdx / Math.max(totalFrames - 1, 1)) * totalDurationMs);
        const tsS = +(tsMs / 1000).toFixed(3);

        const frameState = { ...startState };
        for (const [k, tgt] of Object.entries(stepTargets)) {
          const sVal = startState[k] !== undefined ? startState[k] : (this.rig.defaultState[k] || 0);
          frameState[k] = +(sVal + (tgt - sVal) * ease).toFixed(1);
        }

        stepSines.forEach(sine => {
          const k = sine.stateKey;
          const amp = sine.amplitude;
          const cycles = sine.cycles;
          frameState[k] = +(amp * Math.sin(tNorm * Math.PI * 2 * cycles)).toFixed(1);
        });

        // Phase tagging
        const progress = globalIdx / Math.max(totalFrames - 1, 1);
        const phase = progress < 0.25 ? 'prep' : (progress < 0.75 ? 'stroke' : 'retract');

        frames.push({
          frame_index: globalIdx,
          timestamp_ms: tsMs,
          timestamp_s: tsS,
          phase,
          rig_state: frameState,
          reward: 1.0,
          reward_details: { authoring_fidelity: 1.0 },
          rightHandTip: null
        });

        currentState = frameState;
      }
    });

    const phaseCounts = { prep: 0, stroke: 0, retract: 0 };
    frames.forEach(f => { phaseCounts[f.phase]++; });

    const stepLabels = steps.map(s => {
      const p = s.primary.replace('-', ' ');
      return s.blend ? `${p} + ${s.blend}` : p;
    }).join(' → ');

    const newTermData = {
      term: chainId,
      label: rawName,
      source: 'authored',
      sign_type: 'CompoundGesture',
      location: { major: 'Neutral', minor: 'Custom Chain' },
      movement: 'Compound Chained Sequence',
      handshape: 'Authored',
      authored_spec: `User-defined chained gesture: ${stepLabels} (${steps.length} steps). Strictly velocity-bounded (≤ 12°/frame).`,
      code: 'AUTH-' + chainId.toUpperCase(),
      source_url: '',
      calibration: null,
      mean_reward: null,
      frame_count: frames.length,
      duration_ms: totalDurationMs,
      phase_split: phaseCounts,
      video: null,
      thumbnail: null,
      frames
    };

    // Cache term and add to catalog
    this.cachedTerms.set(chainId, newTermData);
    const catalogEntry = {
      term: chainId,
      label: rawName,
      source: 'authored',
      sign_type: 'CompoundGesture',
      location: { major: 'Neutral', minor: 'Custom Chain' },
      movement: 'Compound Chained Sequence',
      handshape: 'Authored',
      mean_reward: null,
      frame_count: frames.length,
      duration_ms: totalDurationMs,
      thumbnail: null
    };

    this.catalog.unshift(catalogEntry);
    this.applyFilters();

    // Update counts
    const authoredCount = this.catalog.filter(t => t.source === 'authored').length;
    document.getElementById('count-all').textContent = this.catalog.length;
    document.getElementById('count-authored').textContent = authoredCount;

    // Close modal & jump to Detail
    this.closeChainModal();
    window.location.hash = `#/detail/${chainId}`;

    // Auto-play preview
    setTimeout(() => {
      this.play();
    }, 150);
  }

  // --------------------------------------------------------------------------
  // Speech-to-Sign & Autocomplete Controller
  // --------------------------------------------------------------------------
  initSpeechView() {
    if (!this.speechCanvas) return;

    // Corner views toggle in speech canvas
    if (this.speechCornerViewsBtn) {
      this.speechCornerViewsBtn.addEventListener('click', () => {
        this.showCornerViews = !this.showCornerViews;
        this.speechCornerViewsBtn.classList.toggle('active', this.showCornerViews);
        if (this.toggleCornerViewsBtn) {
          this.toggleCornerViewsBtn.classList.toggle('active', this.showCornerViews);
        }
        this.renderSpeechCurrentFrame();
      });
    }

    // Speech Overlay mode toggles (Rig Only, 50% Overlay, Sample Only)
    if (this.speechModeToggles) {
      const speechModeButtons = this.speechModeToggles.querySelectorAll('button[data-mode]');
      speechModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          speechModeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.speechDisplayMode = btn.dataset.mode;
          this.renderSpeechCurrentFrame();
        });
      });
    }

    // Playback control buttons
    if (this.speechReplayBtn) {
      this.speechReplayBtn.addEventListener('click', () => {
        if (this.speechFrames.length > 0) {
          this.speechFrameIdx = 0;
          const firstLearned = this.speechFrames.find(f => f.source === 'learned' && f.video);
          if (this.speechVideo && firstLearned) {
            if (!this.speechVideo.src.endsWith(firstLearned.video)) {
              this.speechVideo.src = firstLearned.video;
              this.speechVideo.load();
            }
            if (firstLearned.timestamp_s !== undefined) {
              this.speechVideo.currentTime = firstLearned.timestamp_s;
            }
          }
          this.playSpeechLoop();
        }
      });
    }

    if (this.speechPauseBtn) {
      this.speechPauseBtn.addEventListener('click', () => {
        if (this.speechIsPlaying) {
          this.pauseSpeechLoop();
        } else if (this.speechFrames.length > 0) {
          this.playSpeechLoop();
        }
      });
    }

    // Submit button
    if (this.speechPlayBtn) {
      this.speechPlayBtn.addEventListener('click', () => {
        const query = this.speechTextInput.value.trim();
        if (query) this.runSpeechSign(query);
      });
    }

    // Clear text button
    if (this.speechClearBtn) {
      this.speechClearBtn.addEventListener('click', () => {
        this.speechTextInput.value = '';
        this.speechClearBtn.style.display = 'none';
        this.closeAutocomplete();
        this.speechTextInput.focus();
      });
    }

    // Autocomplete input listeners
    if (this.speechTextInput) {
      this.speechTextInput.addEventListener('input', (e) => {
        const val = e.target.value;
        this.speechClearBtn.style.display = val ? 'block' : 'none';
        this.handleAutocomplete(val);
      });

      this.speechTextInput.addEventListener('keydown', (e) => {
        this.handleAutocompleteKeydown(e);
      });

      // Close autocomplete on click outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.speech-input-wrap')) {
          this.closeAutocomplete();
        }
      });
    }

    // Quick suggestion pills
    const suggestionPills = document.querySelectorAll('.speech-suggestion-pill');
    suggestionPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const text = pill.dataset.text;
        this.speechTextInput.value = text;
        this.speechClearBtn.style.display = 'block';
        this.closeAutocomplete();
        this.runSpeechSign(text);
      });
    });

    // Initialize Web Speech Recognition
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (this.speechStatusText) {
        this.speechStatusText.textContent = 'Microphone speech recognition is not supported in this browser; keyboard typing with autocomplete is fully enabled.';
      }
      if (this.micBtn) {
        this.micBtn.style.opacity = '0.6';
        this.micBtn.title = 'Speech Recognition not supported in this browser. Use keyboard typing.';
      }
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onstart = () => {
        this.isListening = true;
        this.micBtn.classList.add('listening');
        this.micLabel.textContent = 'Listening...';
        this.speechStatusText.textContent = 'Listening... Speak a sign or phrase (e.g. "Hello", "Thank you", "Water", "Friend").';
      };

      this.speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        this.speechTextInput.value = transcript;
        this.speechClearBtn.style.display = 'block';
        this.speechStatusText.textContent = `Heard: "${transcript}" — processing sequence...`;
        this.runSpeechSign(transcript);
      };

      this.speechRecognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.speechStatusText.textContent = `Microphone notice: ${event.error}. You can also type any word directly.`;
      };

      this.speechRecognition.onend = () => {
        this.isListening = false;
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'Speak Sign';
      };

      this.micBtn.addEventListener('click', () => {
        if (this.isListening) {
          this.speechRecognition.stop();
        } else {
          try {
            this.speechRecognition.start();
          } catch (e) {
            console.warn(e);
          }
        }
      });
    } catch (err) {
      console.warn('Failed to initialize SpeechRecognition:', err);
    }
  }

  handleAutocomplete(query) {
    if (!this.speechAutocomplete) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      this.closeAutocomplete();
      return;
    }

    // Match against catalog
    const matches = this.catalog.filter(item => {
      const label = item.label.toLowerCase();
      const term = item.term.toLowerCase();
      return label.includes(q) || term.includes(q);
    }).slice(0, 8);

    if (matches.length === 0) {
      this.closeAutocomplete();
      return;
    }

    this.speechAutocomplete.innerHTML = matches.map((m, idx) => `
      <div class="autocomplete-item ${idx === 0 ? 'selected' : ''}" data-term="${m.term}" data-label="${m.label}">
        <span class="autocomplete-label">${m.label}</span>
        <span class="autocomplete-meta">${m.source} &bull; ${m.location?.major || 'Neutral'}</span>
      </div>
    `).join('');

    this.speechAutocomplete.style.display = 'block';

    const items = this.speechAutocomplete.querySelectorAll('.autocomplete-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        this.speechTextInput.value = item.dataset.label;
        this.speechClearBtn.style.display = 'block';
        this.closeAutocomplete();
        this.runSpeechSign(item.dataset.label);
      });
    });
  }

  handleAutocompleteKeydown(e) {
    if (!this.speechAutocomplete || this.speechAutocomplete.style.display === 'none') {
      if (e.key === 'Enter') {
        const val = this.speechTextInput.value.trim();
        if (val) this.runSpeechSign(val);
      }
      return;
    }

    const items = Array.from(this.speechAutocomplete.querySelectorAll('.autocomplete-item'));
    if (items.length === 0) return;

    const currentIdx = items.findIndex(it => it.classList.contains('selected'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIdx + 1) % items.length;
      items.forEach(it => it.classList.remove('selected'));
      items[nextIdx].classList.add('selected');
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIdx - 1 + items.length) % items.length;
      items.forEach(it => it.classList.remove('selected'));
      items[prevIdx].classList.add('selected');
      items[prevIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (currentIdx >= 0) {
        e.preventDefault();
        const selected = items[currentIdx];
        this.speechTextInput.value = selected.dataset.label;
        this.closeAutocomplete();
        this.runSpeechSign(selected.dataset.label);
      }
    } else if (e.key === 'Escape') {
      this.closeAutocomplete();
    }
  }

  closeAutocomplete() {
    if (this.speechAutocomplete) {
      this.speechAutocomplete.style.display = 'none';
      this.speechAutocomplete.innerHTML = '';
    }
  }

  parseInputToTerms(text) {
    const raw = text.toLowerCase().replace(/[,.?!]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return [];

    const aliases = {
      'yes': 'agree',
      'no': 'disagree',
      'nod': 'agree',
      'shake': 'disagree',
      'right': 'point-right',
      'left': 'point-left',
      'me': 'point-me',
      'you': 'point-you',
      'it': 'point-it',
      'candy': 'candy_1',
      'corn': 'corn_2',
      'eat': 'eat_1',
      'fine': 'fine_1',
      'stand': 'stand_1',
      'what': 'what_1',
      'thankyou': 'thank_you',
      'thanks': 'thank_you',
      'thank': 'thank_you',
      'hands': 'hands-up',
      'hat': 'hats-off',
      'hats': 'hats-off',
      'rest': 'reset',
      'relax': 'reset'
    };

    const multiWordPhrases = [
      { phrase: 'we don\'t go left', term: 'we-dont-go-left' },
      { phrase: 'we dont go left', term: 'we-dont-go-left' },
      { phrase: 'we go right', term: 'we-go-right' },
      { phrase: 'thank you', term: 'thank_you' },
      { phrase: 'hands up', term: 'hands-up' },
      { phrase: 'hats off', term: 'hats-off' },
      { phrase: 'point you', term: 'point-you' },
      { phrase: 'point me', term: 'point-me' },
      { phrase: 'point right', term: 'point-right' },
      { phrase: 'point left', term: 'point-left' },
      { phrase: 'point it', term: 'point-it' }
    ];

    let remaining = ' ' + raw + ' ';
    const matchedTokens = [];

    // Check multi-word phrases first
    multiWordPhrases.forEach(m => {
      const needle = ' ' + m.phrase + ' ';
      if (remaining.includes(needle)) {
        matchedTokens.push({ text: m.phrase, term: m.term });
        remaining = remaining.replace(needle, ' ');
      }
    });

    // Check single word tokens
    const singleWords = remaining.trim().split(/\s+/).filter(Boolean);
    singleWords.forEach(w => {
      let resolvedTerm = aliases[w] || w;
      const foundInCat = this.catalog.find(c => c.term.toLowerCase() === resolvedTerm || c.label.toLowerCase() === resolvedTerm);
      if (foundInCat) {
        matchedTokens.push({ text: w, term: foundInCat.term });
      } else {
        matchedTokens.push({ text: w, term: null });
      }
    });

    return matchedTokens;
  }

  async runSpeechSign(text) {
    const tokens = this.parseInputToTerms(text);
    if (tokens.length === 0) return;

    // Render sentence chips
    this.speechSentenceRow.style.display = 'flex';
    this.speechChipsContainer.innerHTML = tokens.map((tok, idx) => {
      const isRecognized = !!tok.term;
      return `
        <span class="sentence-chip ${!isRecognized ? 'chip-missing' : ''}" id="chip-step-${idx}">
          ${idx + 1}. ${tok.text} ${isRecognized ? '✓' : '(?)'}
        </span>
      `;
    }).join('');

    const recognizedTerms = tokens.filter(t => t.term).map(t => t.term);
    if (recognizedTerms.length === 0) {
      this.speechStatusText.textContent = `No matching ASL vocabulary found for "${text}". Try "hello", "water", "friend", "thank you", or "we go right".`;
      return;
    }

    this.speechStatusText.textContent = `Executing sequence: ${recognizedTerms.map(t => t.replace('_', ' ')).join(' → ')}...`;

    // Fetch all term data
    const termDataList = [];
    for (const termName of recognizedTerms) {
      let data = this.cachedTerms.get(termName);
      if (!data) {
        try {
          const res = await fetch(`data/terms/${termName}.json`);
          if (res.ok) {
            data = await res.json();
            this.cachedTerms.set(termName, data);
          }
        } catch (e) {
          console.warn(e);
        }
      }
      if (data) termDataList.push(data);
    }

    if (termDataList.length === 0) return;

    // Update metadata card with the primary/first sign
    const firstData = termDataList[0];
    this.speechCardTitle.textContent = termDataList.length > 1
      ? `Chained Sequence (${termDataList.length} signs)`
      : firstData.label;
    this.speechCardBadge.className = `badge ${firstData.source === 'learned' ? 'badge-learned' : 'badge-authored'}`;
    this.speechCardBadge.textContent = firstData.source;
    this.speechMetaTerm.textContent = termDataList.map(d => d.label).join(' → ');
    this.speechMetaPhonology.textContent = `${firstData.location?.major || 'Neutral'} • ${firstData.movement || 'Natural Movement'}`;
    this.speechMetaFrames.textContent = `${termDataList.reduce((acc, d) => acc + d.frame_count, 0)} frames total`;

    // Setup detail inspect button
    this.speechInspectBtn.style.display = 'inline-flex';
    this.speechInspectBtn.href = `#/detail/${firstData.term}`;

    // Combine frames
    const stitchedFrames = [];
    const termTimeline = []; // records frame index ranges for each term

    termDataList.forEach((tData) => {
      const startIdx = stitchedFrames.length;
      tData.frames.forEach(f => {
        stitchedFrames.push({
          ...f,
          termLabel: tData.label,
          termId: tData.term,
          source: tData.source,
          video: tData.video,
          calibration: tData.calibration
        });
      });
      termTimeline.push({
        termLabel: tData.label,
        termId: tData.term,
        source: tData.source,
        video: tData.video,
        calibration: tData.calibration,
        start: startIdx,
        end: stitchedFrames.length - 1
      });
    });

    this.speechFrames = stitchedFrames;
    this.speechCurrentTerms = termTimeline;
    this.speechFrameIdx = 0;

    // Immediately load video if the first sign has one
    const firstLearned = stitchedFrames.find(f => f.source === 'learned' && f.video);
    if (this.speechVideo) {
      if (firstLearned) {
        if (!this.speechVideo.src.endsWith(firstLearned.video)) {
          this.speechVideo.src = firstLearned.video;
          this.speechVideo.load();
        }
        if (firstLearned.timestamp_s !== undefined) {
          this.speechVideo.currentTime = firstLearned.timestamp_s;
        }
      } else {
        this.speechVideo.removeAttribute('src');
      }
    }

    if (this.speechRenderer) {
      this.speechRenderer.resize();
    }

    // Start animated playback
    this.playSpeechLoop();
  }

  playSpeechLoop() {
    if (this.speechRafId) {
      cancelAnimationFrame(this.speechRafId);
      this.speechRafId = null;
    }
    this.speechIsPlaying = true;
    this.speechPauseBtn.textContent = 'Pause';
    this.speechLastFrameTime = performance.now();

    const loop = (now) => {
      if (!this.speechIsPlaying) return;

      const elapsed = now - this.speechLastFrameTime;
      const targetInterval = 33.33; // 30 fps

      if (elapsed >= targetInterval) {
        this.speechLastFrameTime = now;

        if (this.speechFrameIdx >= this.speechFrames.length) {
          this.speechFrameIdx = 0; // loop back
        }

        const currentFrame = this.speechFrames[this.speechFrameIdx];
        if (currentFrame) {
          // Sync video for the current frame
          if (this.speechVideo && currentFrame.source === 'learned' && currentFrame.video) {
            if (!this.speechVideo.src.endsWith(currentFrame.video)) {
              this.speechVideo.src = currentFrame.video;
              this.speechVideo.load();
            }
            if (currentFrame.timestamp_s !== undefined) {
              if (Math.abs(this.speechVideo.currentTime - currentFrame.timestamp_s) > 0.01) {
                this.speechVideo.currentTime = currentFrame.timestamp_s;
              }
            }
          }

          // Update active word badge & progress text
          this.speechActiveWordBadge.textContent = `Signing: ${currentFrame.termLabel || 'Sign'}`;
          this.speechProgressText.textContent = `Frame ${this.speechFrameIdx + 1} / ${this.speechFrames.length} (${currentFrame.phase || 'stroke'})`;

          // Update active chip highlight
          const activeTermIndex = this.speechCurrentTerms.findIndex(t =>
            this.speechFrameIdx >= t.start && this.speechFrameIdx <= t.end
          );
          const chips = this.speechChipsContainer.querySelectorAll('.sentence-chip');
          chips.forEach((c, idx) => {
            c.classList.toggle('chip-active', idx === activeTermIndex);
          });

          this.renderSpeechCurrentFrame();
        }

        this.speechFrameIdx++;
      }

      this.speechRafId = requestAnimationFrame(loop);
    };

    this.speechRafId = requestAnimationFrame(loop);
  }

  pauseSpeechLoop() {
    this.speechIsPlaying = false;
    this.speechPauseBtn.textContent = 'Resume';
    if (this.speechRafId) {
      cancelAnimationFrame(this.speechRafId);
      this.speechRafId = null;
    }
  }

  renderSpeechCurrentFrame() {
    if (!this.speechRenderer) return;
    const frame = this.speechFrames[this.speechFrameIdx] || { rig_state: this.rig.defaultState };

    const underlaySource = (frame.source === 'learned' && this.speechVideo && this.speechVideo.readyState >= 1)
      ? this.speechVideo
      : null;

    this.speechRenderer.render({
      rigState: frame.rig_state,
      displayMode: this.speechDisplayMode,
      underlay: underlaySource,
      calib: frame.calibration,
      rightHandTip: frame.rightHandTip,
      overlayAlpha: 0.50,
      showCornerViews: this.showCornerViews
    });
  }
}

// Instantiate and mount
const app = new CKPEApp();
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
