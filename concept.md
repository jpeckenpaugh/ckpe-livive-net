# CKPE — Concept

**Constrained Kinematic Pose Estimator**
`ckpe.livive.net`

**Status:** v1 (alpha render set) — right-arm only, ~100 ASL terms. See *What v1 does not show* below.

---

## What this is

CKPE is a pipeline for compiling expressive human kinematics from paired image/skeleton samples into a deterministic runtime artifact, called a Domain Instruction Set (DIS).

The architecture follows the same shape as the other `livive-net` projects: the probabilistic work — interrogating data, discovering structure, proposing poses — happens **at build time**, in an RL scorer and CNN oracle. What survives that interrogation is lowered into a small, integer-friendly, auditable DIS. The runtime never calls a generative model. It executes the compiled grammar.

v1 of CKPE is scoped to a single limb — the right arm — across roughly 100 ASL terms derived from studio keyframes of native signers. The SPA at `ckpe.livive.net` is the visible surface of that compilation: it shows *what* the compiler produced, *what evidence* it produced it from, and *how* the artifact fits into a broader architecture. It does not claim to understand ASL. It claims to have compiled a kinematic grammar for a constrained subset, and it shows its work.

---

## The three-level decomposition

Human gesture, as a signal, decomposes into three roughly independent levels:

| Level | What it is | v1 status |
|---|---|---|
| **1. Body** | Gross kinematics — arm, shoulder, torso, head position | **In scope** (right arm only) |
| **2. Hands** | Finger configuration, wrist orientation | Deferred |
| **3. Face** | Gaze, mouth morphemes, expression | Deferred |

Levels 2 and 3 are deferred not because they are unimportant but because including them in v1 would raise the dimensionality of the RL search past the point where the DIS is tractable. The v1 claim is modest: the macroscopic kinematics of the right arm are compiled correctly, and the method by which they were compiled generalizes.

---

## What the artifact looks like

Each term in the alpha set is a JSON file with this shape:

```jsonc
{
  "term": "hello",
  "source": "learned",            // or "authored"
  "sign_type": "OneHanded",
  "location": { "major": "head", "minor": "forehead" },
  "movement": "straight",
  "frames": [
    {
      "rig_state": { "rightShoulderFlexion": 6.2, "rightElbow": 40.1, ... },
      "phase": "prep",             // prep | stroke | retract
      "reward": 0.82,              // fit quality for this frame
      "rightHandTip": [76.1, 123.8] // projected 2D coordinate
    },
    ...
  ]
}
```

The `rig_state` is the DIS output. The `phase` labels are derived from the scorer's segmentation. The `reward` is the visual fit score — how well the projected rig matched the observed skin mask at that frame. The `rightHandTip` coordinate is a convenience for the SPA overlay; it is computed by forward kinematics from the `rig_state`, not stored separately in the runtime.

Motion between frames is bounded by a smoothness constraint (the "no bamfing" rule): joint deltas are capped at a maximum number of degrees per frame. The SPA can show this directly — consecutive frames differ by small increments, never by jumps.

---

## Learned vs. authored

The alpha set contains two kinds of sequences, and the distinction matters:

- **Learned.** Derived by the RL scorer from a real video sample. Each frame carries a `reward` score that reflects how well the DIS state fit the observed frame. The "truth" is the sample.
- **Authored.** Written by hand as a kinematic specification — *"right arm raised to chin level, index extended, head neutral."* No training sample. No reward score. The "truth" is the specification.

Both are DIS artifacts. Both are valid. But their provenance differs, and the SPA should not flatten that distinction. A small badge on each term card (`learned` / `authored`) and a different detail view for each makes the difference legible. A user looking at the SPA can see that some sequences are *compiled from observation* and some are *compiled from specification* — and can see, for the learned ones, the observation they were compiled from.

This is the whole point of the Empirical Knowledge Compilation (EKC) discipline: the artifact is not a black box. It is a compiled thing, and the compilation can be inspected.

---

## The SPA

Three views. Each does one job.

### 1. Index

A searchable, mobile-friendly grid of ~100 term cards. Each card shows a static rest-pose thumbnail, the term name, the source badge (`learned` / `authored`), and one line of metadata (location, movement, handshape). Tapping a card opens the detail view.

Index metadata is loaded on first paint. Full `keyframes.json` files are lazy-loaded on selection. This is what makes the SPA viable on a phone.

### 2. Detail

The core view. For a selected term:

- **Scrubber.** Frame slider with phase regions shaded (`prep` / `stroke` / `retract`). Thumb-reachable. Primary interaction.
- **Front canvas.** The rig rendered in the front view, driven frame-by-frame from `rig_state`. Reuses the existing viewer from `rigd.livive.net/3d/` — no new renderer needed.
- **Overlay toggle.** For learned terms: toggle between (a) the source sample frame, (b) the rig alone, (c) rig overlaid on the sample at 50% opacity. Option (c) is where the fit becomes visible. The per-frame `reward` score is displayed as a small number.
- For authored terms: toggle between (a) rig alone, (b) the authored specification text.
- **Rig state readout.** Joint angles for the current frame, with the previous frame's angles shown as a faint delta. The user sees that the motion is fluid.
- **Metadata block.** `source`, `sample_ref`, `mean_reward`, `frame_count`, `phase_split`.

### 3. Provenance

A static page. No interactivity. This is where the citation work happens.

- One paragraph on the CDE architecture: the hourglass, the severance of knowledge acquisition from knowledge execution, the Aparigraha disclaimer.
- One short block per related project, each with a one-line *what it proves*:

  | Project | What it proves |
  |---|---|
  | `cde` | Bounded expertise can compile to invariant, language-free instruction sets |
  | `mines-sm` | A `no_std`, allocation-free, byte-exact deterministic core is viable |
  | `trot` | A neural network can be trained and exported from readable source |
  | `ocr` | Classical classifiers can be trained in-browser, from scratch |
  | `fourcast` | Heavyweight models reduce to portable ONNX artifacts |
  | `rigd-livive-net` | The rig, the scorer, and the alpha render set |

- One framing sentence: *"CKPE is a candidate DIS for expressive human kinematics. The RL scorer and CNN oracle are the build-time compiler. The rig, FK, projection, and state machine are the runtime artifact. The alpha render set is the first compiled artifact."*
- An honest limits block. See below.

The provenance page is where the "wheel" appears. It is what turns the SPA from a demo into a thesis. It is also where the framing must stay modest.

---

## Geometric constraints

The compilation is tractable because of a small number of geometric priors baked into the DIS. These are documented in `tight_at_roots.md` in the parent repo, and are summarized here because they explain why the artifact looks the way it does.

- **The "fold in half" principle.** The studio setup is symmetric: signers are centered, front-facing, on a solid background, with a known resting pose. The vertical centerline of the image is the spine. Left mirrors right. This resolves much of the 2D-to-3D depth ambiguity at the resting state.
- **The "T" model.** The torso is modeled hierarchically: pelvis as the fixed root, spine as the vertical bar, clavicles as the horizontal bar, arms as the loose leaves. The RL search solves the roots first and the leaves second.
- **Viewport normalization.** The 640×640 viewport is normalized to a 0.5 scale (edges at ±0.25, center at 0, headroom to ±0.5). This allows measurements that exceed the visible frame — extended arms, for example — to be represented without breaking the coordinate system.

The four-pointed star — the constraint system implied by front/side/top/back views of the same instant — is *not* part of v1. It is the mechanism by which the multi-view compilation will work when it is built. v1 uses only the front view.

---

## What v1 does not show

This list is part of the artifact. It is not fine print.

- **No left arm.** v1 is right-arm only. Left-arm sequences are a straightforward extension of the same scorer, but they are not in the alpha set.
- **No hands.** Finger configuration is deferred to Level 2. The right hand in v1 is a kinematic endpoint, not a modeled shape.
- **No face.** Expression and mouth morpheme are deferred to Level 3.
- **No side or top views.** Only the front projection is rendered. The multi-view compilation is the next phase, and requires paired multi-view recording, not a generative model. When side and top views exist, they will be *compiled projections* — derived from paired observations, not recovered facts.
- **No webcam.** The real-time runtime is a future phase. v1 is offline compilation, inspected via the SPA.
- **No Deaf-community validation yet.** The alpha render set was derived from studio samples of native signers. A fluent signer — the eventual beta tester — has not yet evaluated the artifact. Until they have, the correctness of the compiled sequences is a claim about *visual fit to the training sample*, not a claim about *fluency in ASL*.

---

## Framing

CKPE is a kinematics study that uses ASL as a structured test corpus. It is not an accessibility tool. It is not a translation system. It is not a claim to understand sign language.

The properties that make ASL a good corpus are the properties that make it tractable: well-segmented terms, canonical resting states, documented kinematic specifications, and a corpus of studio recordings with controlled lighting, framing, and background. Those properties are shared by pantomime, dance, and athletic gesture. The same architecture, with different training data, would compile a different grammar.

If the DIS compiles correctly for the right arm across ~100 ASL terms, the claim that survives is: *this method can compile kinematic grammar from paired samples into a deterministic runtime artifact, for a constrained subset of human gesture.* That is a defensible claim at v1. Anything larger is deferred.

---

## The meta note

This document is itself a compilation. It is the DIS of a long, high-dimensional conversation — collapsed into the artifact that the SPA will be built from. The conversation was the top bulb. This markdown is the thin waist. The SPA is the bottom bulb, rendering the artifact back into something a visitor can scrub through frame by frame.

The same discipline applies here as to the rig: the artifact is not the process that produced it. The process is discarded when the artifact survives. This document is what survived.




Appendix: A correction to above proposed accuracy claim
The above document says "the macroscopic kinematics of the right arm are compiled correctly." That is an overreach, and this appendix retracts it.

What was wrong. "Compiled correctly" implies a ground truth against which the compilation was checked. v1 has two reasons why that check cannot be made, and both need to be named:

1. No true-3D ground truth. The alpha set was compiled from single-camera front-view recordings. The reward signal measures how well the projected rig overlaps the observed silhouette. It does not measure whether the 3D pose matches the signer's true 3D pose, because that pose was never observed. Front-view projection is depth-ambiguous: a wrong elbow depth can still produce a near-perfect silhouette overlap. "Fit to the front view" is a defensible claim. "Correct pose" is not.

2. Not all source poses are reachable. v1 freezes the shoulders, spine, and head. When the source signer shrugged, leaned, or turned, the observed hand position is mathematically unreachable by the rig — not badly approximated, but outside its reachable set. On those frames the search cannot find the right answer; it finds the nearest wrong answer and reports a low reward. This is a structural limitation of the v1 scope, not a failure of the scorer. The fix is the "tight at the roots" phase: unfreeze the torso, solve the spine and clavicle first, then the arm.

What v1 can actually claim. Something like:

v1 approximates the right arm's front-projected kinematics within a tolerable fault on the majority of reachable keyframes. It does not claim 3D correctness, and it does not claim coverage of every source pose.

A 90–95% visual fit on 90% of keyframes is the floor below which this claim is not worth making. That figure is a bar, not a measured result — the alpha set has not been hand-checked term by term. If it meets the floor, it is a result worth building on: a deterministic runtime artifact, fit to a single limb, across ~100 terms, with its failures visible and attributable to a specific missing degree of freedom. If it does not meet the floor, the honest response is to widen the rig's reachable set before making any accuracy claim at all.

One more caveat. Until a fluent signer — the eventual beta tester — reviews the compiled sequences against their own signing, the claim is fit to the training sample, not fluency in ASL. That review has not happened yet.

The failures that remain after the "tight at the roots" phase — the frames where even an unfrozen torso cannot reach the source pose — are the honest frontier of the method. v1 does not need to reach that frontier. It only needs to point toward it, honestly.
