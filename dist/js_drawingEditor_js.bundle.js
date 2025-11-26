"use strict";
(self["webpackChunkreaction_diffusion_font"] = self["webpackChunkreaction_diffusion_font"] || []).push([["js_drawingEditor_js"],{

/***/ "./js/drawingEditor.js":
/*!*****************************!*\
  !*** ./js/drawingEditor.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   closeDrawingEditor: () => (/* binding */ closeDrawingEditor),
/* harmony export */   openDrawingEditor: () => (/* binding */ openDrawingEditor)
/* harmony export */ });
/* harmony import */ var _parameterValues__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./parameterValues */ "./js/parameterValues.js");
/* harmony import */ var _firstFrame__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./firstFrame */ "./js/firstFrame.js");
//==============================================================
//  DRAWING EDITOR
//  - Modal with dual-layer canvas for drawing seeds and boundaries
//  - Can load and edit existing patterns
//==============================================================




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
function openDrawingEditor(options = {}) {
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
function closeDrawingEditor() {
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
  const width = _parameterValues__WEBPACK_IMPORTED_MODULE_0__["default"].canvas.width;
  const height = _parameterValues__WEBPACK_IMPORTED_MODULE_0__["default"].canvas.height;
  
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
  __webpack_require__.g.customDrawingSeed = seedImageData;
  __webpack_require__.g.customDrawingBoundary = boundaryImageData;
  
  // If boundary has content, enable boundary conditions
  if (hasBoundaryContent) {
    _parameterValues__WEBPACK_IMPORTED_MODULE_0__["default"].boundary.enabled = true;
    console.log('Boundary drawing detected - enabling boundary conditions');
  }
  
  // Close modal
  closeDrawingEditor();
  
  // Apply to simulation
  (0,_firstFrame__WEBPACK_IMPORTED_MODULE_1__.drawFirstFrame)(_firstFrame__WEBPACK_IMPORTED_MODULE_1__.InitialTextureTypes.DRAWING);
  
  console.log('Applied drawing to simulation', {
    hasBoundary: hasBoundaryContent,
    boundaryEnabled: _parameterValues__WEBPACK_IMPORTED_MODULE_0__["default"].boundary.enabled
  });
}


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNfZHJhd2luZ0VkaXRvcl9qcy5idW5kbGUuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRWdEO0FBQ21COztBQUVuRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtDQUFrQzs7QUFFbEMsNEJBQTRCO0FBQzVCLDRCQUE0QjtBQUM1QjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxXQUFXLFFBQVE7QUFDbkIsV0FBVyxXQUFXO0FBQ3RCLFdBQVcsY0FBYztBQUN6QjtBQUNPLHVDQUF1QztBQUM5QyxVQUFVLCtDQUErQztBQUN6RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQix3REFBZTtBQUMvQixpQkFBaUIsd0RBQWU7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCwwQkFBMEI7QUFDOUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBDQUEwQywwQkFBMEI7QUFDcEU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtEQUFrRCwwQkFBMEI7QUFDNUU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQiwwQkFBMEI7QUFDNUMscURBQXFEO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVDQUF1QyxPQUFPO0FBQzlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQixNQUFNLEdBQUcsV0FBVztBQUN6QztBQUNBO0FBQ0E7QUFDQSwwQkFBMEIsT0FBTztBQUNqQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBa0IsbUNBQW1DO0FBQ3JELDRDQUE0QztBQUM1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFLHFCQUFNO0FBQ1IsRUFBRSxxQkFBTTtBQUNSO0FBQ0E7QUFDQTtBQUNBLElBQUksd0RBQWU7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFLDJEQUFjLENBQUMsNERBQW1CO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQix3REFBZTtBQUNwQyxHQUFHO0FBQ0giLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9yZWFjdGlvbi1kaWZmdXNpb24tZm9udC8uL2pzL2RyYXdpbmdFZGl0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gIERSQVdJTkcgRURJVE9SXG4vLyAgLSBNb2RhbCB3aXRoIGR1YWwtbGF5ZXIgY2FudmFzIGZvciBkcmF3aW5nIHNlZWRzIGFuZCBib3VuZGFyaWVzXG4vLyAgLSBDYW4gbG9hZCBhbmQgZWRpdCBleGlzdGluZyBwYXR0ZXJuc1xuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbXBvcnQgcGFyYW1ldGVyVmFsdWVzIGZyb20gJy4vcGFyYW1ldGVyVmFsdWVzJztcbmltcG9ydCB7IGRyYXdGaXJzdEZyYW1lLCBJbml0aWFsVGV4dHVyZVR5cGVzIH0gZnJvbSAnLi9maXJzdEZyYW1lJztcblxubGV0IG1vZGFsID0gbnVsbDtcbmxldCBzZWVkQ2FudmFzID0gbnVsbDtcbmxldCBib3VuZGFyeUNhbnZhcyA9IG51bGw7XG5sZXQgY29tcG9zaXRlQ2FudmFzID0gbnVsbDtcbmxldCBzZWVkQ3R4ID0gbnVsbDtcbmxldCBib3VuZGFyeUN0eCA9IG51bGw7XG5sZXQgY29tcG9zaXRlQ3R4ID0gbnVsbDtcbmxldCBldmVudExpc3RlbmVyc1NldHVwID0gZmFsc2U7ICAvLyBUcmFjayBpZiBldmVudCBsaXN0ZW5lcnMgYXJlIGFscmVhZHkgYXR0YWNoZWRcblxubGV0IGN1cnJlbnRUb29sID0gJ2JydXNoJzsgIC8vICdicnVzaCcgb3IgJ2VyYXNlcidcbmxldCBjdXJyZW50TGF5ZXIgPSAnc2VlZCc7ICAvLyAnc2VlZCcgb3IgJ2JvdW5kYXJ5J1xubGV0IGJydXNoU2l6ZSA9IDIwO1xubGV0IGlzRHJhd2luZyA9IGZhbHNlO1xuXG4vLyBVbmRvL3JlZG8gc3RhY2tzXG5sZXQgc2VlZEhpc3RvcnkgPSBbXTtcbmxldCBib3VuZGFyeUhpc3RvcnkgPSBbXTtcbmxldCBoaXN0b3J5SW5kZXggPSAtMTtcbmNvbnN0IE1BWF9ISVNUT1JZID0gMjA7XG5cbi8vIExheWVyIHZpc2liaWxpdHlcbmxldCBzaG93U2VlZCA9IHRydWU7XG5sZXQgc2hvd0JvdW5kYXJ5ID0gdHJ1ZTtcblxuLyoqXG4gKiBPcGVuIHRoZSBkcmF3aW5nIGVkaXRvciBtb2RhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBDb25maWd1cmF0aW9uXG4gKiBAcGFyYW0ge0ltYWdlRGF0YX0gb3B0aW9ucy5leGlzdGluZ1NlZWQgLSBFeGlzdGluZyBzZWVkIHBhdHRlcm4gdG8gZWRpdFxuICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IG9wdGlvbnMuZXhpc3RpbmdCb3VuZGFyeSAtIEV4aXN0aW5nIGJvdW5kYXJ5IG1hc2sgdG8gZWRpdFxuICovXG5leHBvcnQgZnVuY3Rpb24gb3BlbkRyYXdpbmdFZGl0b3Iob3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IHsgZXhpc3RpbmdTZWVkID0gbnVsbCwgZXhpc3RpbmdCb3VuZGFyeSA9IG51bGwgfSA9IG9wdGlvbnM7XG4gIFxuICAvLyBDcmVhdGUgbW9kYWwgaWYgaXQgZG9lc24ndCBleGlzdFxuICBpZiAoIW1vZGFsKSB7XG4gICAgY3JlYXRlTW9kYWwoKTtcbiAgfVxuICBcbiAgLy8gSW5pdGlhbGl6ZSBjYW52YXNlc1xuICBpbml0aWFsaXplQ2FudmFzZXMoKTtcbiAgXG4gIC8vIFNldHVwIGV2ZW50IGxpc3RlbmVycyAobXVzdCBiZSBhZnRlciBpbml0aWFsaXplQ2FudmFzZXMsIG9ubHkgb25jZSlcbiAgaWYgKCFldmVudExpc3RlbmVyc1NldHVwKSB7XG4gICAgc2V0dXBFdmVudExpc3RlbmVycygpO1xuICAgIGV2ZW50TGlzdGVuZXJzU2V0dXAgPSB0cnVlO1xuICB9XG4gIFxuICAvLyBMb2FkIGV4aXN0aW5nIGRhdGEgaWYgcHJvdmlkZWRcbiAgaWYgKGV4aXN0aW5nU2VlZCkge1xuICAgIGxvYWRTZWVkRGF0YShleGlzdGluZ1NlZWQpO1xuICB9IGVsc2Uge1xuICAgIGNsZWFyTGF5ZXIoJ3NlZWQnKTtcbiAgfVxuICBcbiAgaWYgKGV4aXN0aW5nQm91bmRhcnkpIHtcbiAgICBsb2FkQm91bmRhcnlEYXRhKGV4aXN0aW5nQm91bmRhcnkpO1xuICB9IGVsc2Uge1xuICAgIGNsZWFyTGF5ZXIoJ2JvdW5kYXJ5Jyk7XG4gIH1cbiAgXG4gIC8vIFNhdmUgaW5pdGlhbCBzdGF0ZSB0byBoaXN0b3J5XG4gIHNhdmVUb0hpc3RvcnkoKTtcbiAgXG4gIC8vIFNob3cgbW9kYWxcbiAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgXG4gIC8vIFVwZGF0ZSBjb21wb3NpdGUgdmlld1xuICB1cGRhdGVDb21wb3NpdGUoKTtcbiAgXG4gIGNvbnNvbGUubG9nKCdEcmF3aW5nIGVkaXRvciBvcGVuZWQnKTtcbn1cblxuLyoqXG4gKiBDbG9zZSB0aGUgZHJhd2luZyBlZGl0b3IgbW9kYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlRHJhd2luZ0VkaXRvcigpIHtcbiAgaWYgKG1vZGFsKSB7XG4gICAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSB0aGUgbW9kYWwgSFRNTCBzdHJ1Y3R1cmVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlTW9kYWwoKSB7XG4gIG1vZGFsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG1vZGFsLmlkID0gJ2RyYXdpbmctZWRpdG9yLW1vZGFsJztcbiAgbW9kYWwuY2xhc3NOYW1lID0gJ2RyYXdpbmctZWRpdG9yLW1vZGFsJztcbiAgXG4gIG1vZGFsLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IGNsYXNzPVwiZHJhd2luZy1lZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZHJhd2luZy1lZGl0b3ItaGVhZGVyXCI+XG4gICAgICAgIDxoMj5EcmF3aW5nIEVkaXRvcjwvaDI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJjbG9zZS1idXR0b25cIiBpZD1cImRyYXdpbmctZWRpdG9yLWNsb3NlXCI+4pyVPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgPGRpdiBjbGFzcz1cImRyYXdpbmctZWRpdG9yLWNvbnRyb2xzXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+XG4gICAgICAgICAgPGxhYmVsPkFjdGl2ZSBMYXllcjo8L2xhYmVsPlxuICAgICAgICAgIDxzZWxlY3QgaWQ9XCJkcmF3aW5nLWxheWVyLXNlbGVjdFwiPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInNlZWRcIj5TZWVkIFBhdHRlcm4gKEdyZWVuKTwvb3B0aW9uPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImJvdW5kYXJ5XCI+Qm91bmRhcnkgV2FsbHMgKFJlZCkgLSBFcmFzZSB0byBhbGxvdyBwYXR0ZXJuPC9vcHRpb24+XG4gICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRyb2wtZ3JvdXBcIj5cbiAgICAgICAgICA8bGFiZWw+XG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJkcmF3aW5nLXNob3ctc2VlZFwiIGNoZWNrZWQ+XG4gICAgICAgICAgICBTaG93IFNlZWQgTGF5ZXJcbiAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgIDxsYWJlbD5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImRyYXdpbmctc2hvdy1ib3VuZGFyeVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICBTaG93IEJvdW5kYXJ5IExheWVyXG4gICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IGNsYXNzPVwiY29udHJvbC1ncm91cFwiPlxuICAgICAgICAgIDxsYWJlbD5Ub29sOjwvbGFiZWw+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInRvb2wtYnV0dG9uIGFjdGl2ZVwiIGRhdGEtdG9vbD1cImJydXNoXCI+8J+WjO+4jyBEcmF3IFdhbGw8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwidG9vbC1idXR0b25cIiBkYXRhLXRvb2w9XCJlcmFzZXJcIj7wn6e5IEVyYXNlIChBbGxvdyBQYXR0ZXJuKTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+XG4gICAgICAgICAgPGxhYmVsPkJydXNoIFNpemU6IDxzcGFuIGlkPVwiZHJhd2luZy1icnVzaC1zaXplLXZhbHVlXCI+MjA8L3NwYW4+cHg8L2xhYmVsPlxuICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBpZD1cImRyYXdpbmctYnJ1c2gtc2l6ZVwiIG1pbj1cIjFcIiBtYXg9XCIxMDBcIiB2YWx1ZT1cIjIwXCI+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIDxkaXYgY2xhc3M9XCJkcmF3aW5nLWNhbnZhcy1jb250YWluZXJcIj5cbiAgICAgICAgPGNhbnZhcyBpZD1cImRyYXdpbmctY2FudmFzLWNvbXBvc2l0ZVwiPjwvY2FudmFzPlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIDxkaXYgY2xhc3M9XCJkcmF3aW5nLWVkaXRvci1hY3Rpb25zXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tZ3JvdXBcIj5cbiAgICAgICAgICA8YnV0dG9uIGlkPVwiZHJhd2luZy11bmRvXCI+4oa2IFVuZG88L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIGlkPVwiZHJhd2luZy1yZWRvXCI+4oa3IFJlZG88L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIGlkPVwiZHJhd2luZy1jbGVhci1sYXllclwiPkNsZWFyIExheWVyPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1ncm91cFwiPlxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWltcG9ydC1zZWVkXCI+8J+TgSBJbXBvcnQgU2VlZCBJbWFnZTwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWltcG9ydC1ib3VuZGFyeVwiPvCfk4EgSW1wb3J0IEJvdW5kYXJ5IEltYWdlPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1ncm91cFwiPlxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWV4cG9ydC1zZWVkXCI+8J+SviBFeHBvcnQgU2VlZDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWV4cG9ydC1ib3VuZGFyeVwiPvCfkr4gRXhwb3J0IEJvdW5kYXJ5PC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1ncm91cCBwcmltYXJ5XCI+XG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctY2FuY2VsXCI+Q2FuY2VsPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctYXBwbHlcIiBjbGFzcz1cInByaW1hcnktYnV0dG9uXCI+QXBwbHkgdG8gU2ltdWxhdGlvbjwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtb2RhbCk7XG4gIFxuICAvLyBDcmVhdGUgaGlkZGVuIGZpbGUgaW5wdXRzIGZvciBpbXBvcnRcbiAgY29uc3Qgc2VlZEZpbGVJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gIHNlZWRGaWxlSW5wdXQudHlwZSA9ICdmaWxlJztcbiAgc2VlZEZpbGVJbnB1dC5pZCA9ICdkcmF3aW5nLXNlZWQtZmlsZS1pbnB1dCc7XG4gIHNlZWRGaWxlSW5wdXQuYWNjZXB0ID0gJ2ltYWdlLyonO1xuICBzZWVkRmlsZUlucHV0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc2VlZEZpbGVJbnB1dCk7XG4gIFxuICBjb25zdCBib3VuZGFyeUZpbGVJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gIGJvdW5kYXJ5RmlsZUlucHV0LnR5cGUgPSAnZmlsZSc7XG4gIGJvdW5kYXJ5RmlsZUlucHV0LmlkID0gJ2RyYXdpbmctYm91bmRhcnktZmlsZS1pbnB1dCc7XG4gIGJvdW5kYXJ5RmlsZUlucHV0LmFjY2VwdCA9ICdpbWFnZS8qJztcbiAgYm91bmRhcnlGaWxlSW5wdXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChib3VuZGFyeUZpbGVJbnB1dCk7XG4gIFxuICAvLyBOT1RFOiBFdmVudCBsaXN0ZW5lcnMgd2lsbCBiZSBzZXQgdXAgYWZ0ZXIgY2FudmFzZXMgYXJlIGluaXRpYWxpemVkXG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBjYW52YXMgZWxlbWVudHNcbiAqL1xuZnVuY3Rpb24gaW5pdGlhbGl6ZUNhbnZhc2VzKCkge1xuICBjb25zdCB3aWR0aCA9IHBhcmFtZXRlclZhbHVlcy5jYW52YXMud2lkdGg7XG4gIGNvbnN0IGhlaWdodCA9IHBhcmFtZXRlclZhbHVlcy5jYW52YXMuaGVpZ2h0O1xuICBcbiAgLy8gQ29tcG9zaXRlIGNhbnZhcyAodmlzaWJsZSlcbiAgY29tcG9zaXRlQ2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctY2FudmFzLWNvbXBvc2l0ZScpO1xuICBjb21wb3NpdGVDYW52YXMud2lkdGggPSB3aWR0aDtcbiAgY29tcG9zaXRlQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgY29tcG9zaXRlQ3R4ID0gY29tcG9zaXRlQ2FudmFzLmdldENvbnRleHQoJzJkJywgeyB3aWxsUmVhZEZyZXF1ZW50bHk6IHRydWUgfSk7XG4gIFxuICAvLyBTZWVkIGxheWVyIChvZmZzY3JlZW4pXG4gIHNlZWRDYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgc2VlZENhbnZhcy53aWR0aCA9IHdpZHRoO1xuICBzZWVkQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgc2VlZEN0eCA9IHNlZWRDYW52YXMuZ2V0Q29udGV4dCgnMmQnLCB7IHdpbGxSZWFkRnJlcXVlbnRseTogdHJ1ZSB9KTtcbiAgXG4gIC8vIEJvdW5kYXJ5IGxheWVyIChvZmZzY3JlZW4pXG4gIGJvdW5kYXJ5Q2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gIGJvdW5kYXJ5Q2FudmFzLndpZHRoID0gd2lkdGg7XG4gIGJvdW5kYXJ5Q2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgYm91bmRhcnlDdHggPSBib3VuZGFyeUNhbnZhcy5nZXRDb250ZXh0KCcyZCcsIHsgd2lsbFJlYWRGcmVxdWVudGx5OiB0cnVlIH0pO1xufVxuXG4vKipcbiAqIFNldHVwIGFsbCBldmVudCBsaXN0ZW5lcnNcbiAqL1xuZnVuY3Rpb24gc2V0dXBFdmVudExpc3RlbmVycygpIHtcbiAgLy8gQ2xvc2UgYnV0dG9uXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWVkaXRvci1jbG9zZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2xvc2VEcmF3aW5nRWRpdG9yKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctY2FuY2VsJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbG9zZURyYXdpbmdFZGl0b3IpO1xuICBcbiAgLy8gTGF5ZXIgc2VsZWN0aW9uXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWxheWVyLXNlbGVjdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XG4gICAgY3VycmVudExheWVyID0gZS50YXJnZXQudmFsdWU7XG4gICAgdXBkYXRlQ29tcG9zaXRlKCk7XG4gIH0pO1xuICBcbiAgLy8gTGF5ZXIgdmlzaWJpbGl0eSB0b2dnbGVzXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLXNob3ctc2VlZCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XG4gICAgc2hvd1NlZWQgPSBlLnRhcmdldC5jaGVja2VkO1xuICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xuICB9KTtcbiAgXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLXNob3ctYm91bmRhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xuICAgIHNob3dCb3VuZGFyeSA9IGUudGFyZ2V0LmNoZWNrZWQ7XG4gICAgdXBkYXRlQ29tcG9zaXRlKCk7XG4gIH0pO1xuICBcbiAgLy8gVG9vbCBzZWxlY3Rpb25cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRvb2wtYnV0dG9uJykuZm9yRWFjaChidG4gPT4ge1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcudG9vbC1idXR0b24nKS5mb3JFYWNoKGIgPT4gYi5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKSk7XG4gICAgICBlLnRhcmdldC5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbiAgICAgIGN1cnJlbnRUb29sID0gZS50YXJnZXQuZGF0YXNldC50b29sO1xuICAgIH0pO1xuICB9KTtcbiAgXG4gIC8vIEJydXNoIHNpemVcbiAgY29uc3QgYnJ1c2hTaXplU2xpZGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZScpO1xuICBjb25zdCBicnVzaFNpemVWYWx1ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJydXNoLXNpemUtdmFsdWUnKTtcbiAgYnJ1c2hTaXplU2xpZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGUpID0+IHtcbiAgICBicnVzaFNpemUgPSBwYXJzZUludChlLnRhcmdldC52YWx1ZSk7XG4gICAgYnJ1c2hTaXplVmFsdWUudGV4dENvbnRlbnQgPSBicnVzaFNpemU7XG4gIH0pO1xuICBcbiAgLy8gRHJhd2luZyBvbiBjb21wb3NpdGUgY2FudmFzXG4gIGNvbXBvc2l0ZUNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBzdGFydERyYXdpbmcpO1xuICBjb21wb3NpdGVDYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgZHJhdyk7XG4gIGNvbXBvc2l0ZUNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgc3RvcERyYXdpbmcpO1xuICBjb21wb3NpdGVDYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHN0b3BEcmF3aW5nKTtcbiAgXG4gIC8vIFVuZG8vUmVkb1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy11bmRvJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB1bmRvKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctcmVkbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcmVkbyk7XG4gIFxuICAvLyBDbGVhciBsYXllclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1jbGVhci1sYXllcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIGNsZWFyTGF5ZXIoY3VycmVudExheWVyKTtcbiAgICBzYXZlVG9IaXN0b3J5KCk7XG4gICAgdXBkYXRlQ29tcG9zaXRlKCk7XG4gIH0pO1xuICBcbiAgLy8gSW1wb3J0XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWltcG9ydC1zZWVkJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctc2VlZC1maWxlLWlucHV0JykuY2xpY2soKTtcbiAgfSk7XG4gIFxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1pbXBvcnQtYm91bmRhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1ib3VuZGFyeS1maWxlLWlucHV0JykuY2xpY2soKTtcbiAgfSk7XG4gIFxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1zZWVkLWZpbGUtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xuICAgIGltcG9ydEltYWdlKGUudGFyZ2V0LmZpbGVzWzBdLCAnc2VlZCcpO1xuICB9KTtcbiAgXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJvdW5kYXJ5LWZpbGUtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xuICAgIGltcG9ydEltYWdlKGUudGFyZ2V0LmZpbGVzWzBdLCAnYm91bmRhcnknKTtcbiAgfSk7XG4gIFxuICAvLyBFeHBvcnRcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctZXhwb3J0LXNlZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGV4cG9ydExheWVyKCdzZWVkJykpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1leHBvcnQtYm91bmRhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGV4cG9ydExheWVyKCdib3VuZGFyeScpKTtcbiAgXG4gIC8vIEFwcGx5XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWFwcGx5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhcHBseURyYXdpbmcpO1xuICBcbiAgLy8gS2V5Ym9hcmQgc2hvcnRjdXRzXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVLZXlib2FyZCk7XG59XG5cbi8qKlxuICogSGFuZGxlIGtleWJvYXJkIHNob3J0Y3V0c1xuICovXG5mdW5jdGlvbiBoYW5kbGVLZXlib2FyZChlKSB7XG4gIC8vIE9ubHkgaGFuZGxlIGlmIG1vZGFsIGlzIG9wZW5cbiAgaWYgKCFtb2RhbCB8fCBtb2RhbC5zdHlsZS5kaXNwbGF5ID09PSAnbm9uZScpIHJldHVybjtcbiAgXG4gIGlmIChlLmtleSA9PT0gJ2InIHx8IGUua2V5ID09PSAnQicpIHtcbiAgICBjdXJyZW50VG9vbCA9ICdicnVzaCc7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdG9vbD1cImJydXNoXCJdJykuY2xpY2soKTtcbiAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ2UnIHx8IGUua2V5ID09PSAnRScpIHtcbiAgICBjdXJyZW50VG9vbCA9ICdlcmFzZXInO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRvb2w9XCJlcmFzZXJcIl0nKS5jbGljaygpO1xuICB9IGVsc2UgaWYgKGUuY3RybEtleSAmJiBlLmtleSA9PT0gJ3onKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHVuZG8oKTtcbiAgfSBlbHNlIGlmIChlLmN0cmxLZXkgJiYgZS5rZXkgPT09ICd5Jykge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICByZWRvKCk7XG4gIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdbJykge1xuICAgIGJydXNoU2l6ZSA9IE1hdGgubWF4KDEsIGJydXNoU2l6ZSAtIDUpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJydXNoLXNpemUnKS52YWx1ZSA9IGJydXNoU2l6ZTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1icnVzaC1zaXplLXZhbHVlJykudGV4dENvbnRlbnQgPSBicnVzaFNpemU7XG4gIH0gZWxzZSBpZiAoZS5rZXkgPT09ICddJykge1xuICAgIGJydXNoU2l6ZSA9IE1hdGgubWluKDEwMCwgYnJ1c2hTaXplICsgNSk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZScpLnZhbHVlID0gYnJ1c2hTaXplO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJydXNoLXNpemUtdmFsdWUnKS50ZXh0Q29udGVudCA9IGJydXNoU2l6ZTtcbiAgfVxufVxuXG4vKipcbiAqIFN0YXJ0IGRyYXdpbmdcbiAqL1xuZnVuY3Rpb24gc3RhcnREcmF3aW5nKGUpIHtcbiAgaXNEcmF3aW5nID0gdHJ1ZTtcbiAgY29uc3QgcmVjdCA9IGNvbXBvc2l0ZUNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgY29uc3QgeCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICBkcmF3UG9pbnQoeCwgeSk7XG59XG5cbi8qKlxuICogRHJhdyB3aGlsZSBtb3ZpbmdcbiAqL1xuZnVuY3Rpb24gZHJhdyhlKSB7XG4gIGlmICghaXNEcmF3aW5nKSByZXR1cm47XG4gIFxuICBjb25zdCByZWN0ID0gY29tcG9zaXRlQ2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBjb25zdCB4ID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuICBjb25zdCB5ID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gIGRyYXdQb2ludCh4LCB5KTtcbn1cblxuLyoqXG4gKiBTdG9wIGRyYXdpbmdcbiAqL1xuZnVuY3Rpb24gc3RvcERyYXdpbmcoKSB7XG4gIGlmIChpc0RyYXdpbmcpIHtcbiAgICBpc0RyYXdpbmcgPSBmYWxzZTtcbiAgICBzYXZlVG9IaXN0b3J5KCk7XG4gIH1cbn1cblxuLyoqXG4gKiBEcmF3IGEgcG9pbnQgb24gdGhlIGFjdGl2ZSBsYXllclxuICovXG5mdW5jdGlvbiBkcmF3UG9pbnQoeCwgeSkge1xuICBjb25zdCBjdHggPSBjdXJyZW50TGF5ZXIgPT09ICdzZWVkJyA/IHNlZWRDdHggOiBib3VuZGFyeUN0eDtcbiAgXG4gIGN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSBjdXJyZW50VG9vbCA9PT0gJ2JydXNoJyA/ICdzb3VyY2Utb3ZlcicgOiAnZGVzdGluYXRpb24tb3V0JztcbiAgY3R4LmZpbGxTdHlsZSA9ICcjMDAwJztcbiAgY3R4LmJlZ2luUGF0aCgpO1xuICBjdHguYXJjKHgsIHksIGJydXNoU2l6ZSAvIDIsIDAsIE1hdGguUEkgKiAyKTtcbiAgY3R4LmZpbGwoKTtcbiAgXG4gIHVwZGF0ZUNvbXBvc2l0ZSgpO1xufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgY29tcG9zaXRlIGNhbnZhcyB2aWV3XG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUNvbXBvc2l0ZSgpIHtcbiAgLy8gQ2xlYXIgY29tcG9zaXRlIHdpdGggd2hpdGUgYmFja2dyb3VuZFxuICBjb21wb3NpdGVDdHguZmlsbFN0eWxlID0gJyNmZmYnO1xuICBjb21wb3NpdGVDdHguZmlsbFJlY3QoMCwgMCwgY29tcG9zaXRlQ2FudmFzLndpZHRoLCBjb21wb3NpdGVDYW52YXMuaGVpZ2h0KTtcbiAgXG4gIC8vIERyYXcgc2VlZCBsYXllciAoYmxhY2sgb24gd2hpdGUpIHdpdGggZ3JlZW4gdGludFxuICBpZiAoc2hvd1NlZWQpIHtcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQWxwaGEgPSAxLjA7XG4gICAgY29tcG9zaXRlQ3R4Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9ICdzb3VyY2Utb3Zlcic7XG4gICAgXG4gICAgLy8gRHJhdyBzZWVkIGNhbnZhc1xuICAgIGNvbXBvc2l0ZUN0eC5kcmF3SW1hZ2Uoc2VlZENhbnZhcywgMCwgMCk7XG4gICAgXG4gICAgLy8gQXBwbHkgZ3JlZW4gdGludCB0byBibGFjayBhcmVhc1xuICAgIGNvbXBvc2l0ZUN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnbXVsdGlwbHknO1xuICAgIGNvbXBvc2l0ZUN0eC5maWxsU3R5bGUgPSAncmdiYSgxMDAsIDI1NSwgMTAwLCAxLjApJztcbiAgICBjb21wb3NpdGVDdHguZmlsbFJlY3QoMCwgMCwgY29tcG9zaXRlQ2FudmFzLndpZHRoLCBjb21wb3NpdGVDYW52YXMuaGVpZ2h0KTtcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcbiAgfVxuICBcbiAgLy8gRHJhdyBib3VuZGFyeSBsYXllciAoYmxhY2sgb24gdHJhbnNwYXJlbnQpIHdpdGggcmVkIHRpbnRcbiAgaWYgKHNob3dCb3VuZGFyeSkge1xuICAgIGNvbXBvc2l0ZUN0eC5nbG9iYWxBbHBoYSA9IDEuMDtcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcbiAgICBcbiAgICAvLyBDcmVhdGUgYSB0ZW1wb3JhcnkgY2FudmFzIHRvIGFwcGx5IHJlZCB0aW50IHRvIGJvdW5kYXJ5XG4gICAgY29uc3QgdGVtcENhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRlbXBDYW52YXMud2lkdGggPSBib3VuZGFyeUNhbnZhcy53aWR0aDtcbiAgICB0ZW1wQ2FudmFzLmhlaWdodCA9IGJvdW5kYXJ5Q2FudmFzLmhlaWdodDtcbiAgICBjb25zdCB0ZW1wQ3R4ID0gdGVtcENhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIFxuICAgIC8vIERyYXcgYm91bmRhcnkgY2FudmFzXG4gICAgdGVtcEN0eC5kcmF3SW1hZ2UoYm91bmRhcnlDYW52YXMsIDAsIDApO1xuICAgIFxuICAgIC8vIENoYW5nZSBibGFjayBwaXhlbHMgdG8gcmVkXG4gICAgdGVtcEN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnc291cmNlLWluJztcbiAgICB0ZW1wQ3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDI1NSwgNTAsIDUwLCAwLjcpJztcbiAgICB0ZW1wQ3R4LmZpbGxSZWN0KDAsIDAsIHRlbXBDYW52YXMud2lkdGgsIHRlbXBDYW52YXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IHRpbnRlZCBib3VuZGFyeSB0byBjb21wb3NpdGVcbiAgICBjb21wb3NpdGVDdHguZHJhd0ltYWdlKHRlbXBDYW52YXMsIDAsIDApO1xuICAgIGNvbXBvc2l0ZUN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnc291cmNlLW92ZXInO1xuICB9XG59XG5cbi8qKlxuICogQ2xlYXIgYSBzcGVjaWZpYyBsYXllclxuICovXG4vKipcbiAqIENsZWFyIGEgbGF5ZXJcbiAqL1xuZnVuY3Rpb24gY2xlYXJMYXllcihsYXllcikge1xuICBjb25zdCBjdHggPSBsYXllciA9PT0gJ3NlZWQnID8gc2VlZEN0eCA6IGJvdW5kYXJ5Q3R4O1xuICBcbiAgaWYgKGxheWVyID09PSAnc2VlZCcpIHtcbiAgICAvLyBTZWVkIGxheWVyOiB3aGl0ZSBiYWNrZ3JvdW5kIChubyBzZWVkIHBhdHRlcm4pXG4gICAgY3R4LmZpbGxTdHlsZSA9ICcjZmZmJztcbiAgICBjdHguZmlsbFJlY3QoMCwgMCwgY3R4LmNhbnZhcy53aWR0aCwgY3R4LmNhbnZhcy5oZWlnaHQpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJvdW5kYXJ5IGxheWVyOiBmdWxsIGJsYWNrIChhbGwgY29uc3RyYWluZWQgLSB1c2VyIGVyYXNlcyB0byBhbGxvdyBwYXR0ZXJuKVxuICAgIGN0eC5maWxsU3R5bGUgPSAnIzAwMCc7XG4gICAgY3R4LmZpbGxSZWN0KDAsIDAsIGN0eC5jYW52YXMud2lkdGgsIGN0eC5jYW52YXMuaGVpZ2h0KTtcbiAgfVxufVxuXG4vKipcbiAqIExvYWQgc2VlZCBkYXRhIGZyb20gSW1hZ2VEYXRhXG4gKi9cbmZ1bmN0aW9uIGxvYWRTZWVkRGF0YShpbWFnZURhdGEpIHtcbiAgc2VlZEN0eC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcbn1cblxuLyoqXG4gKiBMb2FkIGJvdW5kYXJ5IGRhdGEgZnJvbSBGbG9hdDMyQXJyYXlcbiAqL1xuZnVuY3Rpb24gbG9hZEJvdW5kYXJ5RGF0YShib3VuZGFyeUFycmF5KSB7XG4gIGNvbnN0IHdpZHRoID0gYm91bmRhcnlDYW52YXMud2lkdGg7XG4gIGNvbnN0IGhlaWdodCA9IGJvdW5kYXJ5Q2FudmFzLmhlaWdodDtcbiAgY29uc3QgaW1hZ2VEYXRhID0gYm91bmRhcnlDdHguY3JlYXRlSW1hZ2VEYXRhKHdpZHRoLCBoZWlnaHQpO1xuICBcbiAgLy8gQ29udmVydCBGbG9hdDMyQXJyYXkgKDAuMC0xLjApIHRvIFJHQkFcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBib3VuZGFyeUFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgdmFsdWUgPSBib3VuZGFyeUFycmF5W2ldID4gMC41ID8gMCA6IDI1NTsgIC8vIEJsYWNrID0gaW5zaWRlLCB3aGl0ZSA9IG91dHNpZGVcbiAgICBpbWFnZURhdGEuZGF0YVtpICogNF0gPSB2YWx1ZTtcbiAgICBpbWFnZURhdGEuZGF0YVtpICogNCArIDFdID0gdmFsdWU7XG4gICAgaW1hZ2VEYXRhLmRhdGFbaSAqIDQgKyAyXSA9IHZhbHVlO1xuICAgIGltYWdlRGF0YS5kYXRhW2kgKiA0ICsgM10gPSAyNTU7XG4gIH1cbiAgXG4gIGJvdW5kYXJ5Q3R4LnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xufVxuXG4vKipcbiAqIFNhdmUgY3VycmVudCBzdGF0ZSB0byBoaXN0b3J5XG4gKi9cbmZ1bmN0aW9uIHNhdmVUb0hpc3RvcnkoKSB7XG4gIC8vIFRydW5jYXRlIGhpc3RvcnkgaWYgd2UncmUgbm90IGF0IHRoZSBlbmRcbiAgaWYgKGhpc3RvcnlJbmRleCA8IHNlZWRIaXN0b3J5Lmxlbmd0aCAtIDEpIHtcbiAgICBzZWVkSGlzdG9yeSA9IHNlZWRIaXN0b3J5LnNsaWNlKDAsIGhpc3RvcnlJbmRleCArIDEpO1xuICAgIGJvdW5kYXJ5SGlzdG9yeSA9IGJvdW5kYXJ5SGlzdG9yeS5zbGljZSgwLCBoaXN0b3J5SW5kZXggKyAxKTtcbiAgfVxuICBcbiAgLy8gQWRkIGN1cnJlbnQgc3RhdGVcbiAgc2VlZEhpc3RvcnkucHVzaChzZWVkQ3R4LmdldEltYWdlRGF0YSgwLCAwLCBzZWVkQ2FudmFzLndpZHRoLCBzZWVkQ2FudmFzLmhlaWdodCkpO1xuICBib3VuZGFyeUhpc3RvcnkucHVzaChib3VuZGFyeUN0eC5nZXRJbWFnZURhdGEoMCwgMCwgYm91bmRhcnlDYW52YXMud2lkdGgsIGJvdW5kYXJ5Q2FudmFzLmhlaWdodCkpO1xuICBcbiAgaGlzdG9yeUluZGV4Kys7XG4gIFxuICAvLyBMaW1pdCBoaXN0b3J5IHNpemVcbiAgaWYgKHNlZWRIaXN0b3J5Lmxlbmd0aCA+IE1BWF9ISVNUT1JZKSB7XG4gICAgc2VlZEhpc3Rvcnkuc2hpZnQoKTtcbiAgICBib3VuZGFyeUhpc3Rvcnkuc2hpZnQoKTtcbiAgICBoaXN0b3J5SW5kZXgtLTtcbiAgfVxufVxuXG4vKipcbiAqIFVuZG8gbGFzdCBhY3Rpb25cbiAqL1xuZnVuY3Rpb24gdW5kbygpIHtcbiAgaWYgKGhpc3RvcnlJbmRleCA+IDApIHtcbiAgICBoaXN0b3J5SW5kZXgtLTtcbiAgICBzZWVkQ3R4LnB1dEltYWdlRGF0YShzZWVkSGlzdG9yeVtoaXN0b3J5SW5kZXhdLCAwLCAwKTtcbiAgICBib3VuZGFyeUN0eC5wdXRJbWFnZURhdGEoYm91bmRhcnlIaXN0b3J5W2hpc3RvcnlJbmRleF0sIDAsIDApO1xuICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xuICB9XG59XG5cbi8qKlxuICogUmVkbyBsYXN0IHVuZG9uZSBhY3Rpb25cbiAqL1xuZnVuY3Rpb24gcmVkbygpIHtcbiAgaWYgKGhpc3RvcnlJbmRleCA8IHNlZWRIaXN0b3J5Lmxlbmd0aCAtIDEpIHtcbiAgICBoaXN0b3J5SW5kZXgrKztcbiAgICBzZWVkQ3R4LnB1dEltYWdlRGF0YShzZWVkSGlzdG9yeVtoaXN0b3J5SW5kZXhdLCAwLCAwKTtcbiAgICBib3VuZGFyeUN0eC5wdXRJbWFnZURhdGEoYm91bmRhcnlIaXN0b3J5W2hpc3RvcnlJbmRleF0sIDAsIDApO1xuICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xuICB9XG59XG5cbi8qKlxuICogSW1wb3J0IGltYWdlIGZpbGVcbiAqL1xuZnVuY3Rpb24gaW1wb3J0SW1hZ2UoZmlsZSwgbGF5ZXIpIHtcbiAgaWYgKCFmaWxlKSByZXR1cm47XG4gIFxuICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICByZWFkZXIub25sb2FkID0gKGUpID0+IHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3R4ID0gbGF5ZXIgPT09ICdzZWVkJyA/IHNlZWRDdHggOiBib3VuZGFyeUN0eDtcbiAgICAgIFxuICAgICAgLy8gRHJhdyBpbWFnZSB0byBsYXllciBjYW52YXNcbiAgICAgIGN0eC5maWxsU3R5bGUgPSAnI2ZmZic7XG4gICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY3R4LmNhbnZhcy53aWR0aCwgY3R4LmNhbnZhcy5oZWlnaHQpO1xuICAgICAgXG4gICAgICAvLyBTY2FsZSBpbWFnZSB0byBmaXQgY2FudmFzXG4gICAgICBjb25zdCBzY2FsZSA9IE1hdGgubWluKFxuICAgICAgICBjdHguY2FudmFzLndpZHRoIC8gaW1nLndpZHRoLFxuICAgICAgICBjdHguY2FudmFzLmhlaWdodCAvIGltZy5oZWlnaHRcbiAgICAgICk7XG4gICAgICBjb25zdCB4ID0gKGN0eC5jYW52YXMud2lkdGggLSBpbWcud2lkdGggKiBzY2FsZSkgLyAyO1xuICAgICAgY29uc3QgeSA9IChjdHguY2FudmFzLmhlaWdodCAtIGltZy5oZWlnaHQgKiBzY2FsZSkgLyAyO1xuICAgICAgXG4gICAgICBjdHguZHJhd0ltYWdlKGltZywgeCwgeSwgaW1nLndpZHRoICogc2NhbGUsIGltZy5oZWlnaHQgKiBzY2FsZSk7XG4gICAgICBcbiAgICAgIHNhdmVUb0hpc3RvcnkoKTtcbiAgICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgSW1wb3J0ZWQgaW1hZ2UgdG8gJHtsYXllcn0gbGF5ZXJgKTtcbiAgICB9O1xuICAgIGltZy5zcmMgPSBlLnRhcmdldC5yZXN1bHQ7XG4gIH07XG4gIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xufVxuXG4vKipcbiAqIEV4cG9ydCBsYXllciBhcyBQTkdcbiAqL1xuZnVuY3Rpb24gZXhwb3J0TGF5ZXIobGF5ZXIpIHtcbiAgY29uc3QgY2FudmFzID0gbGF5ZXIgPT09ICdzZWVkJyA/IHNlZWRDYW52YXMgOiBib3VuZGFyeUNhbnZhcztcbiAgY29uc3QgZGF0YVVSTCA9IGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpO1xuICBcbiAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgbGluay5kb3dubG9hZCA9IGAke2xheWVyfS0ke0RhdGUubm93KCl9LnBuZ2A7XG4gIGxpbmsuaHJlZiA9IGRhdGFVUkw7XG4gIGxpbmsuY2xpY2soKTtcbiAgXG4gIGNvbnNvbGUubG9nKGBFeHBvcnRlZCAke2xheWVyfSBsYXllcmApO1xufVxuXG4vKipcbiAqIEFwcGx5IGRyYXdpbmcgdG8gc2ltdWxhdGlvblxuICovXG5mdW5jdGlvbiBhcHBseURyYXdpbmcoKSB7XG4gIC8vIEdldCBzZWVkIGRhdGFcbiAgY29uc3Qgc2VlZEltYWdlRGF0YSA9IHNlZWRDdHguZ2V0SW1hZ2VEYXRhKDAsIDAsIHNlZWRDYW52YXMud2lkdGgsIHNlZWRDYW52YXMuaGVpZ2h0KTtcbiAgXG4gIC8vIEdldCBib3VuZGFyeSBkYXRhXG4gIGNvbnN0IGJvdW5kYXJ5SW1hZ2VEYXRhID0gYm91bmRhcnlDdHguZ2V0SW1hZ2VEYXRhKDAsIDAsIGJvdW5kYXJ5Q2FudmFzLndpZHRoLCBib3VuZGFyeUNhbnZhcy5oZWlnaHQpO1xuICBcbiAgLy8gQ2hlY2sgaWYgYm91bmRhcnkgaGFzIGFueSBjb250ZW50IChub24tdHJhbnNwYXJlbnQgcGl4ZWxzKVxuICBsZXQgaGFzQm91bmRhcnlDb250ZW50ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAzOyBpIDwgYm91bmRhcnlJbWFnZURhdGEuZGF0YS5sZW5ndGg7IGkgKz0gNCkge1xuICAgIGlmIChib3VuZGFyeUltYWdlRGF0YS5kYXRhW2ldID4gMTI4KSB7ICAvLyBBbHBoYSBjaGFubmVsID4gMTI4XG4gICAgICBoYXNCb3VuZGFyeUNvbnRlbnQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIFxuICAvLyBTdG9yZSBpbiBnbG9iYWwgZm9yIGFjY2VzcyBieSBmaXJzdEZyYW1lLmpzXG4gIGdsb2JhbC5jdXN0b21EcmF3aW5nU2VlZCA9IHNlZWRJbWFnZURhdGE7XG4gIGdsb2JhbC5jdXN0b21EcmF3aW5nQm91bmRhcnkgPSBib3VuZGFyeUltYWdlRGF0YTtcbiAgXG4gIC8vIElmIGJvdW5kYXJ5IGhhcyBjb250ZW50LCBlbmFibGUgYm91bmRhcnkgY29uZGl0aW9uc1xuICBpZiAoaGFzQm91bmRhcnlDb250ZW50KSB7XG4gICAgcGFyYW1ldGVyVmFsdWVzLmJvdW5kYXJ5LmVuYWJsZWQgPSB0cnVlO1xuICAgIGNvbnNvbGUubG9nKCdCb3VuZGFyeSBkcmF3aW5nIGRldGVjdGVkIC0gZW5hYmxpbmcgYm91bmRhcnkgY29uZGl0aW9ucycpO1xuICB9XG4gIFxuICAvLyBDbG9zZSBtb2RhbFxuICBjbG9zZURyYXdpbmdFZGl0b3IoKTtcbiAgXG4gIC8vIEFwcGx5IHRvIHNpbXVsYXRpb25cbiAgZHJhd0ZpcnN0RnJhbWUoSW5pdGlhbFRleHR1cmVUeXBlcy5EUkFXSU5HKTtcbiAgXG4gIGNvbnNvbGUubG9nKCdBcHBsaWVkIGRyYXdpbmcgdG8gc2ltdWxhdGlvbicsIHtcbiAgICBoYXNCb3VuZGFyeTogaGFzQm91bmRhcnlDb250ZW50LFxuICAgIGJvdW5kYXJ5RW5hYmxlZDogcGFyYW1ldGVyVmFsdWVzLmJvdW5kYXJ5LmVuYWJsZWRcbiAgfSk7XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=