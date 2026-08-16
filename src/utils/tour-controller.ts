/**
 * Tour Controller — manages guided tour playback on `<model-viewer>`.
 *
 * The controller reads tour step data, drives camera transitions,
 * plays audio, and auto-advances through steps.
 */

export interface TourStep {
  cameraOrbit: string;
  cameraTarget?: string;
  fieldOfView?: string;
  text: { de: string; en: string };
  audio?: { de: string; en: string };
  durationMs?: number;
}

type TourState = 'idle' | 'playing' | 'paused';

interface TourElements {
  viewer: HTMLElement & {
    cameraOrbit: string;
    cameraTarget: string;
    fieldOfView: string;
    interpolationDecay: number;
    autoRotate: boolean;
    cameraControls: boolean;
    getCameraOrbit: () => { theta: number; phi: number; radius: number; toString: () => string };
    getCameraTarget: () => { x: number; y: number; z: number; toString: () => string };
    getFieldOfView: () => number;
  };
  container: HTMLElement;
  overlay: HTMLElement;
  textEl: HTMLElement;
  stepIndicator: HTMLElement;
  progressBar: HTMLElement;
  exitBtn: HTMLElement;
}

const DEFAULT_DURATION_MS = 5000;
const TRANSITION_BUFFER_MS = 1200; // wait for camera interpolation before starting audio/timer

export function initTourController() {
  const containers = document.querySelectorAll('.model-viewer-container');

  containers.forEach((container) => {
    const tourDataAttr = container.getAttribute('data-tour');
    if (!tourDataAttr) return;

    const langAttr = container.getAttribute('data-tour-lang') || 'en';
    const lang = langAttr as 'de' | 'en';

    let steps: TourStep[];
    try {
      steps = JSON.parse(tourDataAttr);
    } catch {
      console.error('Tour: Failed to parse tour data');
      return;
    }

    if (!steps || steps.length === 0) return;

    // Find the play button
    const playBtn = container.querySelector('.tour-play-btn') as HTMLElement | null;
    if (!playBtn) return;

    // Find tour overlay elements
    const overlay = document.getElementById('tour-overlay');
    const textEl = document.getElementById('tour-text');
    const stepIndicator = document.getElementById('tour-step-indicator');
    const progressBar = document.getElementById('tour-progress-bar');
    const exitBtn = document.getElementById('tour-exit-btn');
    const viewer = container.querySelector('model-viewer') as TourElements['viewer'] | null;

    if (!overlay || !textEl || !stepIndicator || !progressBar || !exitBtn || !viewer) {
      console.error('Tour: Missing required DOM elements');
      return;
    }

    const elements: TourElements = {
      viewer,
      container: container as HTMLElement,
      overlay,
      textEl,
      stepIndicator,
      progressBar,
      exitBtn,
    };

    let state: TourState = 'idle';
    let currentStep = 0;
    let audio: HTMLAudioElement | null = null;
    let advanceTimer: ReturnType<typeof setTimeout> | null = null;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let initialOrbit = '';
    let initialTarget = '';
    let initialFov = '';
    let initialAutoRotate = true;

    function saveInitialCamera() {
      initialOrbit = elements.viewer.getAttribute('camera-orbit') || elements.viewer.getCameraOrbit().toString();
      initialTarget = elements.viewer.getAttribute('camera-target') || elements.viewer.getCameraTarget().toString();
      initialFov = elements.viewer.getAttribute('field-of-view') || '';
      initialAutoRotate = elements.viewer.autoRotate;
    }

    function restoreInitialCamera() {
      elements.viewer.cameraOrbit = initialOrbit;
      elements.viewer.cameraTarget = initialTarget;
      if (initialFov) elements.viewer.fieldOfView = initialFov;
      elements.viewer.autoRotate = initialAutoRotate;
      elements.viewer.cameraControls = true;
    }

    function enterTourMode() {
      saveInitialCamera();
      state = 'playing';
      currentStep = 0;

      // Disable user interaction during tour
      elements.viewer.autoRotate = false;
      elements.viewer.cameraControls = false;
      elements.viewer.interpolationDecay = 100;

      // Activate overlay and promote model-viewer
      elements.overlay.classList.add('tour-overlay--active');
      elements.container.classList.add('tour-active');
      document.body.style.overflow = 'hidden';

      // Hide the play button
      playBtn!.style.display = 'none';

      playStep(0);
    }

    function exitTourMode() {
      state = 'idle';

      // Stop audio
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audio = null;
      }

      // Clear timers
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      // Deactivate overlay
      elements.overlay.classList.remove('tour-overlay--active');
      elements.container.classList.remove('tour-active');
      document.body.style.overflow = '';

      // Restore camera
      elements.viewer.interpolationDecay = 50; // restore default
      restoreInitialCamera();

      // Show play button again
      playBtn!.style.display = '';

      // Reset progress
      elements.progressBar.style.width = '0%';
      elements.textEl.textContent = '';
      elements.textEl.classList.remove('tour-text--visible');
    }

    function playStep(index: number) {
      if (state !== 'playing' || index >= steps.length) {
        // Tour finished
        if (index >= steps.length) {
          exitTourMode();
        }
        return;
      }

      currentStep = index;
      const step = steps[index];

      // Update step indicator
      elements.stepIndicator.textContent = `${index + 1} / ${steps.length}`;

      // Render progress dots
      renderProgressDots(index);

      // Reset progress bar
      elements.progressBar.style.transition = 'none';
      elements.progressBar.style.width = '0%';

      // Hide text during camera transition
      elements.textEl.classList.remove('tour-text--visible');

      // Set camera position (model-viewer interpolates automatically)
      elements.viewer.cameraOrbit = step.cameraOrbit;
      if (step.cameraTarget) {
        elements.viewer.cameraTarget = step.cameraTarget;
      }
      if (step.fieldOfView) {
        elements.viewer.fieldOfView = step.fieldOfView;
      }

      // Wait for camera transition, then show text and start audio/timer
      setTimeout(() => {
        if (state !== 'playing') return;

        // Show text
        // A tour step may not cover every locale the work is published in.
        // Fall back to any locale that has text rather than to English
        // specifically — no locale is privileged — and only then to empty.
        elements.textEl.textContent =
          step.text[lang] || Object.values(step.text ?? {}).find(Boolean) || '';
        elements.textEl.classList.add('tour-text--visible');

        // Determine duration and start audio or timer
        const audioSrc = step.audio?.[lang] || step.audio?.en;

        if (audioSrc) {
          playAudioForStep(audioSrc, step.durationMs);
        } else {
          startTimerForStep(step.durationMs || DEFAULT_DURATION_MS);
        }
      }, TRANSITION_BUFFER_MS);
    }

    function playAudioForStep(src: string, fallbackDurationMs?: number) {
      audio = new Audio(src);

      audio.addEventListener('ended', () => {
        advanceToNextStep();
      }, { once: true });

      audio.addEventListener('error', () => {
        console.warn('Tour: Audio failed to load, falling back to timer');
        startTimerForStep(fallbackDurationMs || DEFAULT_DURATION_MS);
      }, { once: true });

      // Start progress animation based on audio duration
      audio.addEventListener('loadedmetadata', () => {
        if (!audio) return;
        const durationMs = audio.duration * 1000;
        animateProgressBar(durationMs);
      }, { once: true });

      audio.play().catch(() => {
        console.warn('Tour: Audio autoplay blocked, falling back to timer');
        startTimerForStep(fallbackDurationMs || DEFAULT_DURATION_MS);
      });
    }

    function startTimerForStep(durationMs: number) {
      animateProgressBar(durationMs);
      advanceTimer = setTimeout(() => {
        advanceToNextStep();
      }, durationMs);
    }

    function animateProgressBar(durationMs: number) {
      // Reset
      elements.progressBar.style.transition = 'none';
      elements.progressBar.style.width = '0%';

      // Force reflow
      void elements.progressBar.offsetWidth;

      // Animate
      elements.progressBar.style.transition = `width ${durationMs}ms linear`;
      elements.progressBar.style.width = '100%';
    }

    function advanceToNextStep() {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      // Stop current audio
      if (audio) {
        audio.pause();
        audio = null;
      }

      playStep(currentStep + 1);
    }

    function renderProgressDots(activeIndex: number) {
      const dotsContainer = document.getElementById('tour-progress-dots');
      if (!dotsContainer) return;

      dotsContainer.innerHTML = '';
      steps.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'tour-dot' + (i === activeIndex ? ' tour-dot--active' : i < activeIndex ? ' tour-dot--done' : '');
        dotsContainer.appendChild(dot);
      });
    }

    // Event listeners
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      enterTourMode();
    });

    exitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exitTourMode();
    });

    // Escape key exits tour
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state === 'playing') {
        exitTourMode();
      }
    });

    // Click on overlay backdrop (not on model or panel) exits tour
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        exitTourMode();
      }
    });
  });
}
