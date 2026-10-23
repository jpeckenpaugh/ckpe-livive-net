# ckpe-livive-net

**Constrained Kinematic Pose Estimator (CKPE)**
Live SPA: [https://ckpe.livive.net/](https://ckpe.livive.net/)

The visible surface and interactive inspector for the Level 1 kinematic foundation described in [`concept.md`](concept.md).

---

## What This SPA Does

CKPE compiles expressive human kinematics from studio keyframes into a deterministic runtime artifact called a **Domain Instruction Set (DIS)**:
- Probabilistic search and RL optimization happen **at build time**.
- The web runtime executes the compiled grammar using vanilla forward kinematics and the Canvas 2D API with zero machine learning dependencies in production.
- Strictly bounds joint velocities to $\le 12^\circ/\text{frame}$ ($360^\circ/\text{sec}$ at 30 fps) to enforce the "no bamfing" biological continuity rule.

---

## Three Views

1. **Index View (`#/index`):**
   - Instant-paint catalog grid across 109 compiled sequences (100 learned from native signers + 9 authored kinematic specifications).
   - Fast client-side search by name, anatomical location, movement, and handshape.
   - Filter pills distinguishing `learned` vs `authored` provenance and body regions (Cranial, Thoracic, Neutral space).

2. **Detail View (`#/detail/<term>`):**
   - **Front Canvas:** Interactive 2D projection with calibrated alignment against source video keyframes.
   - **Visual Overlay Modes:** Toggle between `Rig Only`, `50% Overlay`, and `Sample Only`.
   - **Real-Time Scrubber:** Mobile thumb-accessible frame slider with color-coded phase tracks (`prep` $\to$ `stroke` $\to$ `retract`).
   - **Kinematic State Readout:** Live angle display with frame-by-frame velocity deltas ($\Delta$) validating zero-bamf bound adherence.
   - **Per-Frame Reward Badge:** Displays visual silhouette fit score for learned terms or specification text for authored terms.

3. **Provenance View (`#/provenance`):**
   - Documents the CDE Hourglass architecture (severance of knowledge acquisition from execution).
   - Cross-project evidence matrix (`cde`, `mines-sm`, `trot`, `ocr`, `fourcast`, `rigd-livive-net`).
   - Honest scope boundaries and accuracy limits (front-view depth ambiguity, reachability bounds awaiting the "tight at the roots" torso phase).

---

## Zero Dependencies

Built with native ES Modules, vanilla CSS, and the Canvas 2D API. No bundlers, no external frameworks, no runtime npm packages.
