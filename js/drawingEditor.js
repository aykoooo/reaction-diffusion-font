//==============================================================
//  DRAWING EDITOR
//  - Modal with dual-layer canvas for drawing seeds and boundaries
//  - Can load and edit existing patterns
//==============================================================

import parameterValues from './parameterValues';
import { drawFirstFrame, InitialTextureTypes } from './firstFrame';

let modal = null;
let seedCanvas = null;
let boundaryCanvas = null;
let compositeCanvas = null;
let seedCtx = null;
let boundaryCtx = null;
let compositeCtx = null;
let eventListenersSetup = false;  // Track if event listeners are already attached

let currentTool = 'brush';  // 'brush' or 'eraser'
let currentLayer = 'seed';  // 'seed' or 'boundary'
let brushSize = 20;
let isDrawing = false;

// Undo/redo stacks
let seedHistory = [];
let boundaryHistory = [];
let historyIndex = -1;
const MAX_HISTORY = 20;

// Layer visibility
let showSeed = true;
let showBoundary = true;

/**
 * Open the drawing editor modal
 * @param {Object} options - Configuration
 * @param {ImageData} options.existingSeed - Existing seed pattern to edit
 * @param {Float32Array} options.existingBoundary - Existing boundary mask to edit
 */
export function openDrawingEditor(options = {}) {
  const { existingSeed = null, existingBoundary = null } = options;
  
  // Create modal if it doesn't exist
  if (!modal) {
    createModal();
  }
  
  // Initialize canvases
  initializeCanvases();
  
  // Setup event listeners (must be after initializeCanvases, only once)
  if (!eventListenersSetup) {
    setupEventListeners();
    eventListenersSetup = true;
  }
  
  // Load existing data if provided
  if (existingSeed) {
    loadSeedData(existingSeed);
  } else {
    clearLayer('seed');
  }
  
  if (existingBoundary) {
    loadBoundaryData(existingBoundary);
  } else {
    clearLayer('boundary');
  }
  
  // Save initial state to history
  saveToHistory();
  
  // Show modal
  modal.style.display = 'flex';
  
  // Update composite view
  updateComposite();
  
  console.log('Drawing editor opened');
}

/**
 * Close the drawing editor modal
 */
export function closeDrawingEditor() {
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Create the modal HTML structure
 */
function createModal() {
  modal = document.createElement('div');
  modal.id = 'drawing-editor-modal';
  modal.className = 'drawing-editor-modal';
  
  modal.innerHTML = `
    <div class="drawing-editor-container">
      <div class="drawing-editor-header">
        <h2>Drawing Editor</h2>
        <button class="close-button" id="drawing-editor-close">✕</button>
      </div>
      
      <div class="drawing-editor-controls">
        <div class="control-group">
          <label>Active Layer:</label>
          <select id="drawing-layer-select">
            <option value="seed">Seed Pattern (Green)</option>
            <option value="boundary">Boundary Walls (Red) - Erase to allow pattern</option>
          </select>
        </div>
        
        <div class="control-group">
          <label>
            <input type="checkbox" id="drawing-show-seed" checked>
            Show Seed Layer
          </label>
          <label>
            <input type="checkbox" id="drawing-show-boundary" checked>
            Show Boundary Layer
          </label>
        </div>
        
        <div class="control-group">
          <label>Tool:</label>
          <button class="tool-button active" data-tool="brush">🖌️ Draw Wall</button>
          <button class="tool-button" data-tool="eraser">🧹 Erase (Allow Pattern)</button>
        </div>
        
        <div class="control-group">
          <label>Brush Size: <span id="drawing-brush-size-value">20</span>px</label>
          <input type="range" id="drawing-brush-size" min="1" max="100" value="20">
        </div>
      </div>
      
      <div class="drawing-canvas-container">
        <canvas id="drawing-canvas-composite"></canvas>
      </div>
      
      <div class="drawing-editor-actions">
        <div class="action-group">
          <button id="drawing-undo">↶ Undo</button>
          <button id="drawing-redo">↷ Redo</button>
          <button id="drawing-clear-layer">Clear Layer</button>
        </div>
        
        <div class="action-group">
          <button id="drawing-import-seed">📁 Import Seed Image</button>
          <button id="drawing-import-boundary">📁 Import Boundary Image</button>
        </div>
        
        <div class="action-group">
          <button id="drawing-export-seed">💾 Export Seed</button>
          <button id="drawing-export-boundary">💾 Export Boundary</button>
        </div>
        
        <div class="action-group primary">
          <button id="drawing-cancel">Cancel</button>
          <button id="drawing-apply" class="primary-button">Apply to Simulation</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Create hidden file inputs for import
  const seedFileInput = document.createElement('input');
  seedFileInput.type = 'file';
  seedFileInput.id = 'drawing-seed-file-input';
  seedFileInput.accept = 'image/*';
  seedFileInput.style.display = 'none';
  document.body.appendChild(seedFileInput);
  
  const boundaryFileInput = document.createElement('input');
  boundaryFileInput.type = 'file';
  boundaryFileInput.id = 'drawing-boundary-file-input';
  boundaryFileInput.accept = 'image/*';
  boundaryFileInput.style.display = 'none';
  document.body.appendChild(boundaryFileInput);
  
  // NOTE: Event listeners will be set up after canvases are initialized
}

/**
 * Initialize canvas elements
 */
function initializeCanvases() {
  const width = parameterValues.canvas.width;
  const height = parameterValues.canvas.height;
  
  // Composite canvas (visible)
  compositeCanvas = document.getElementById('drawing-canvas-composite');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  compositeCtx = compositeCanvas.getContext('2d', { willReadFrequently: true });
  
  // Seed layer (offscreen)
  seedCanvas = document.createElement('canvas');
  seedCanvas.width = width;
  seedCanvas.height = height;
  seedCtx = seedCanvas.getContext('2d', { willReadFrequently: true });
  
  // Boundary layer (offscreen)
  boundaryCanvas = document.createElement('canvas');
  boundaryCanvas.width = width;
  boundaryCanvas.height = height;
  boundaryCtx = boundaryCanvas.getContext('2d', { willReadFrequently: true });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Close button
  document.getElementById('drawing-editor-close').addEventListener('click', closeDrawingEditor);
  document.getElementById('drawing-cancel').addEventListener('click', closeDrawingEditor);
  
  // Layer selection
  document.getElementById('drawing-layer-select').addEventListener('change', (e) => {
    currentLayer = e.target.value;
    updateComposite();
  });
  
  // Layer visibility toggles
  document.getElementById('drawing-show-seed').addEventListener('change', (e) => {
    showSeed = e.target.checked;
    updateComposite();
  });
  
  document.getElementById('drawing-show-boundary').addEventListener('change', (e) => {
    showBoundary = e.target.checked;
    updateComposite();
  });
  
  // Tool selection
  document.querySelectorAll('.tool-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentTool = e.target.dataset.tool;
    });
  });
  
  // Brush size
  const brushSizeSlider = document.getElementById('drawing-brush-size');
  const brushSizeValue = document.getElementById('drawing-brush-size-value');
  brushSizeSlider.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    brushSizeValue.textContent = brushSize;
  });
  
  // Drawing on composite canvas
  compositeCanvas.addEventListener('mousedown', startDrawing);
  compositeCanvas.addEventListener('mousemove', draw);
  compositeCanvas.addEventListener('mouseup', stopDrawing);
  compositeCanvas.addEventListener('mouseleave', stopDrawing);
  
  // Undo/Redo
  document.getElementById('drawing-undo').addEventListener('click', undo);
  document.getElementById('drawing-redo').addEventListener('click', redo);
  
  // Clear layer
  document.getElementById('drawing-clear-layer').addEventListener('click', () => {
    clearLayer(currentLayer);
    saveToHistory();
    updateComposite();
  });
  
  // Import
  document.getElementById('drawing-import-seed').addEventListener('click', () => {
    document.getElementById('drawing-seed-file-input').click();
  });
  
  document.getElementById('drawing-import-boundary').addEventListener('click', () => {
    document.getElementById('drawing-boundary-file-input').click();
  });
  
  document.getElementById('drawing-seed-file-input').addEventListener('change', (e) => {
    importImage(e.target.files[0], 'seed');
  });
  
  document.getElementById('drawing-boundary-file-input').addEventListener('change', (e) => {
    importImage(e.target.files[0], 'boundary');
  });
  
  // Export
  document.getElementById('drawing-export-seed').addEventListener('click', () => exportLayer('seed'));
  document.getElementById('drawing-export-boundary').addEventListener('click', () => exportLayer('boundary'));
  
  // Apply
  document.getElementById('drawing-apply').addEventListener('click', applyDrawing);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
  // Only handle if modal is open
  if (!modal || modal.style.display === 'none') return;
  
  if (e.key === 'b' || e.key === 'B') {
    currentTool = 'brush';
    document.querySelector('[data-tool="brush"]').click();
  } else if (e.key === 'e' || e.key === 'E') {
    currentTool = 'eraser';
    document.querySelector('[data-tool="eraser"]').click();
  } else if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  } else if (e.key === '[') {
    brushSize = Math.max(1, brushSize - 5);
    document.getElementById('drawing-brush-size').value = brushSize;
    document.getElementById('drawing-brush-size-value').textContent = brushSize;
  } else if (e.key === ']') {
    brushSize = Math.min(100, brushSize + 5);
    document.getElementById('drawing-brush-size').value = brushSize;
    document.getElementById('drawing-brush-size-value').textContent = brushSize;
  }
}

/**
 * Start drawing
 */
function startDrawing(e) {
  isDrawing = true;
  const rect = compositeCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawPoint(x, y);
}

/**
 * Draw while moving
 */
function draw(e) {
  if (!isDrawing) return;
  
  const rect = compositeCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawPoint(x, y);
}

/**
 * Stop drawing
 */
function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    saveToHistory();
  }
}

/**
 * Draw a point on the active layer
 */
function drawPoint(x, y) {
  const ctx = currentLayer === 'seed' ? seedCtx : boundaryCtx;
  
  ctx.globalCompositeOperation = currentTool === 'brush' ? 'source-over' : 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  updateComposite();
}

/**
 * Update the composite canvas view
 */
function updateComposite() {
  // Clear composite with white background
  compositeCtx.fillStyle = '#fff';
  compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
  
  // Draw seed layer (black on white) with green tint
  if (showSeed) {
    compositeCtx.globalAlpha = 1.0;
    compositeCtx.globalCompositeOperation = 'source-over';
    
    // Draw seed canvas
    compositeCtx.drawImage(seedCanvas, 0, 0);
    
    // Apply green tint to black areas
    compositeCtx.globalCompositeOperation = 'multiply';
    compositeCtx.fillStyle = 'rgba(100, 255, 100, 1.0)';
    compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
    compositeCtx.globalCompositeOperation = 'source-over';
  }
  
  // Draw boundary layer (black on transparent) with red tint
  if (showBoundary) {
    compositeCtx.globalAlpha = 1.0;
    compositeCtx.globalCompositeOperation = 'source-over';
    
    // Create a temporary canvas to apply red tint to boundary
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = boundaryCanvas.width;
    tempCanvas.height = boundaryCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw boundary canvas
    tempCtx.drawImage(boundaryCanvas, 0, 0);
    
    // Change black pixels to red
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = 'rgba(255, 50, 50, 0.7)';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw tinted boundary to composite
    compositeCtx.drawImage(tempCanvas, 0, 0);
    compositeCtx.globalCompositeOperation = 'source-over';
  }
}

/**
 * Clear a specific layer
 */
/**
 * Clear a layer
 */
function clearLayer(layer) {
  const ctx = layer === 'seed' ? seedCtx : boundaryCtx;
  
  if (layer === 'seed') {
    // Seed layer: white background (no seed pattern)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    // Boundary layer: full black (all constrained - user erases to allow pattern)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

/**
 * Load seed data from ImageData
 */
function loadSeedData(imageData) {
  seedCtx.putImageData(imageData, 0, 0);
}

/**
 * Load boundary data from Float32Array
 */
function loadBoundaryData(boundaryArray) {
  const width = boundaryCanvas.width;
  const height = boundaryCanvas.height;
  const imageData = boundaryCtx.createImageData(width, height);
  
  // Convert Float32Array (0.0-1.0) to RGBA
  for (let i = 0; i < boundaryArray.length; i++) {
    const value = boundaryArray[i] > 0.5 ? 0 : 255;  // Black = inside, white = outside
    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }
  
  boundaryCtx.putImageData(imageData, 0, 0);
}

/**
 * Save current state to history
 */
function saveToHistory() {
  // Truncate history if we're not at the end
  if (historyIndex < seedHistory.length - 1) {
    seedHistory = seedHistory.slice(0, historyIndex + 1);
    boundaryHistory = boundaryHistory.slice(0, historyIndex + 1);
  }
  
  // Add current state
  seedHistory.push(seedCtx.getImageData(0, 0, seedCanvas.width, seedCanvas.height));
  boundaryHistory.push(boundaryCtx.getImageData(0, 0, boundaryCanvas.width, boundaryCanvas.height));
  
  historyIndex++;
  
  // Limit history size
  if (seedHistory.length > MAX_HISTORY) {
    seedHistory.shift();
    boundaryHistory.shift();
    historyIndex--;
  }
}

/**
 * Undo last action
 */
function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    seedCtx.putImageData(seedHistory[historyIndex], 0, 0);
    boundaryCtx.putImageData(boundaryHistory[historyIndex], 0, 0);
    updateComposite();
  }
}

/**
 * Redo last undone action
 */
function redo() {
  if (historyIndex < seedHistory.length - 1) {
    historyIndex++;
    seedCtx.putImageData(seedHistory[historyIndex], 0, 0);
    boundaryCtx.putImageData(boundaryHistory[historyIndex], 0, 0);
    updateComposite();
  }
}

/**
 * Import image file
 */
function importImage(file, layer) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const ctx = layer === 'seed' ? seedCtx : boundaryCtx;
      
      // Draw image to layer canvas
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Scale image to fit canvas
      const scale = Math.min(
        ctx.canvas.width / img.width,
        ctx.canvas.height / img.height
      );
      const x = (ctx.canvas.width - img.width * scale) / 2;
      const y = (ctx.canvas.height - img.height * scale) / 2;
      
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      
      saveToHistory();
      updateComposite();
      
      console.log(`Imported image to ${layer} layer`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Export layer as PNG
 */
function exportLayer(layer) {
  const canvas = layer === 'seed' ? seedCanvas : boundaryCanvas;
  const dataURL = canvas.toDataURL('image/png');
  
  const link = document.createElement('a');
  link.download = `${layer}-${Date.now()}.png`;
  link.href = dataURL;
  link.click();
  
  console.log(`Exported ${layer} layer`);
}

/**
 * Apply drawing to simulation
 */
function applyDrawing() {
  // Get seed data
  const seedImageData = seedCtx.getImageData(0, 0, seedCanvas.width, seedCanvas.height);
  
  // Get boundary data
  const boundaryImageData = boundaryCtx.getImageData(0, 0, boundaryCanvas.width, boundaryCanvas.height);
  
  // Check if boundary has any content (non-transparent pixels)
  let hasBoundaryContent = false;
  for (let i = 3; i < boundaryImageData.data.length; i += 4) {
    if (boundaryImageData.data[i] > 128) {  // Alpha channel > 128
      hasBoundaryContent = true;
      break;
    }
  }
  
  // Store in global for access by firstFrame.js
  global.customDrawingSeed = seedImageData;
  global.customDrawingBoundary = boundaryImageData;
  
  // If boundary has content, enable boundary conditions
  if (hasBoundaryContent) {
    parameterValues.boundary.enabled = true;
    console.log('Boundary drawing detected - enabling boundary conditions');
  }
  
  // Close modal
  closeDrawingEditor();
  
  // Apply to simulation
  drawFirstFrame(InitialTextureTypes.DRAWING);
  
  console.log('Applied drawing to simulation', {
    hasBoundary: hasBoundaryContent,
    boundaryEnabled: parameterValues.boundary.enabled
  });
}
