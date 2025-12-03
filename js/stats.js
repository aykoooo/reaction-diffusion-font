import fps from 'fps';

let numIterations = 0, iterationsPerFrame;
let targetIterations = 0;  // 0 = unlimited
let onTargetReached = null;  // callback when target hit
let ticker = fps({ every: 60 });
let statsContainerEl, fpsEl, iterCountEl;

export function setupStats(_iterationsPerFrame) {
  iterationsPerFrame = _iterationsPerFrame;

  statsContainerEl = document.createElement('div');
  statsContainerEl.setAttribute('id', 'stats-container');
  document.body.appendChild(statsContainerEl);

  setupIterationsCounter();
  setupFPSCounter();
}

  function setupIterationsCounter() {
    iterCountEl = document.createElement('div');
    iterCountEl.setAttribute('id', 'iteration-counter');
    iterCountEl.innerHTML = 'test';
    statsContainerEl.appendChild(iterCountEl);
  }

  function setupFPSCounter() {
    fpsEl = document.createElement('div');
    fpsEl.setAttribute('id', 'fps-counter');
    statsContainerEl.appendChild(fpsEl);

    ticker.on('data', (framerate) => {
      fpsEl.innerHTML = String(Math.round(framerate)) + ' fps';
    });
  }

export function resetIterations() {
  numIterations = 0;
  updateIterationDisplay();
}

export function setTargetIterations(target, callback) {
  targetIterations = target;
  onTargetReached = callback;
  updateIterationDisplay();
}

export function getIterationCount() {
  return numIterations;
}

export function getTargetIterations() {
  return targetIterations;
}

function updateIterationDisplay() {
  if (!iterCountEl) return;
  let display = 'iterations: ' + numIterations.toLocaleString();
  if (targetIterations > 0) {
    display += ' / ' + targetIterations.toLocaleString();
  }
  iterCountEl.innerHTML = display + ' <span aria-hidden="true">•</span>&nbsp;';
}

export function updateStats(isPaused) {
  ticker.tick();

  if(!isPaused) {
    numIterations += iterationsPerFrame;
    updateIterationDisplay();

    // Check if target reached
    if (targetIterations > 0 && numIterations >= targetIterations) {
      if (onTargetReached) {
        onTargetReached();
      }
    }
  }
}