"use strict";
(self["webpackChunkreaction_diffusion_playground"] = self["webpackChunkreaction_diffusion_playground"] || []).push([["js_drawingEditor_js"],{

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNfZHJhd2luZ0VkaXRvcl9qcy5idW5kbGUuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNnRDtBQUNtQjtBQUNuRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0NBQWtDO0FBQ2xDO0FBQ0EsNEJBQTRCO0FBQzVCLDRCQUE0QjtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLFFBQVE7QUFDbkIsV0FBVyxXQUFXO0FBQ3RCLFdBQVcsY0FBYztBQUN6QjtBQUNPLHVDQUF1QztBQUM5QyxVQUFVLCtDQUErQztBQUN6RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQix3REFBZTtBQUMvQixpQkFBaUIsd0RBQWU7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCwwQkFBMEI7QUFDOUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBDQUEwQywwQkFBMEI7QUFDcEU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtEQUFrRCwwQkFBMEI7QUFDNUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBa0IsMEJBQTBCO0FBQzVDLHFEQUFxRDtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUNBQXVDLE9BQU87QUFDOUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQixNQUFNLEdBQUcsV0FBVztBQUN6QztBQUNBO0FBQ0E7QUFDQSwwQkFBMEIsT0FBTztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLG1DQUFtQztBQUNyRCw0Q0FBNEM7QUFDNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxxQkFBTTtBQUNSLEVBQUUscUJBQU07QUFDUjtBQUNBO0FBQ0E7QUFDQSxJQUFJLHdEQUFlO0FBQ25CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSwyREFBYyxDQUFDLDREQUFtQjtBQUNwQztBQUNBO0FBQ0E7QUFDQSxxQkFBcUIsd0RBQWU7QUFDcEMsR0FBRztBQUNIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcmVhY3Rpb24tZGlmZnVzaW9uLXBsYXlncm91bmQvLi9qcy9kcmF3aW5nRWRpdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gIERSQVdJTkcgRURJVE9SXHJcbi8vICAtIE1vZGFsIHdpdGggZHVhbC1sYXllciBjYW52YXMgZm9yIGRyYXdpbmcgc2VlZHMgYW5kIGJvdW5kYXJpZXNcclxuLy8gIC0gQ2FuIGxvYWQgYW5kIGVkaXQgZXhpc3RpbmcgcGF0dGVybnNcclxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuaW1wb3J0IHBhcmFtZXRlclZhbHVlcyBmcm9tICcuL3BhcmFtZXRlclZhbHVlcyc7XHJcbmltcG9ydCB7IGRyYXdGaXJzdEZyYW1lLCBJbml0aWFsVGV4dHVyZVR5cGVzIH0gZnJvbSAnLi9maXJzdEZyYW1lJztcclxuXHJcbmxldCBtb2RhbCA9IG51bGw7XHJcbmxldCBzZWVkQ2FudmFzID0gbnVsbDtcclxubGV0IGJvdW5kYXJ5Q2FudmFzID0gbnVsbDtcclxubGV0IGNvbXBvc2l0ZUNhbnZhcyA9IG51bGw7XHJcbmxldCBzZWVkQ3R4ID0gbnVsbDtcclxubGV0IGJvdW5kYXJ5Q3R4ID0gbnVsbDtcclxubGV0IGNvbXBvc2l0ZUN0eCA9IG51bGw7XHJcbmxldCBldmVudExpc3RlbmVyc1NldHVwID0gZmFsc2U7ICAvLyBUcmFjayBpZiBldmVudCBsaXN0ZW5lcnMgYXJlIGFscmVhZHkgYXR0YWNoZWRcclxuXHJcbmxldCBjdXJyZW50VG9vbCA9ICdicnVzaCc7ICAvLyAnYnJ1c2gnIG9yICdlcmFzZXInXHJcbmxldCBjdXJyZW50TGF5ZXIgPSAnc2VlZCc7ICAvLyAnc2VlZCcgb3IgJ2JvdW5kYXJ5J1xyXG5sZXQgYnJ1c2hTaXplID0gMjA7XHJcbmxldCBpc0RyYXdpbmcgPSBmYWxzZTtcclxuXHJcbi8vIFVuZG8vcmVkbyBzdGFja3NcclxubGV0IHNlZWRIaXN0b3J5ID0gW107XHJcbmxldCBib3VuZGFyeUhpc3RvcnkgPSBbXTtcclxubGV0IGhpc3RvcnlJbmRleCA9IC0xO1xyXG5jb25zdCBNQVhfSElTVE9SWSA9IDIwO1xyXG5cclxuLy8gTGF5ZXIgdmlzaWJpbGl0eVxyXG5sZXQgc2hvd1NlZWQgPSB0cnVlO1xyXG5sZXQgc2hvd0JvdW5kYXJ5ID0gdHJ1ZTtcclxuXHJcbi8qKlxyXG4gKiBPcGVuIHRoZSBkcmF3aW5nIGVkaXRvciBtb2RhbFxyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb25cclxuICogQHBhcmFtIHtJbWFnZURhdGF9IG9wdGlvbnMuZXhpc3RpbmdTZWVkIC0gRXhpc3Rpbmcgc2VlZCBwYXR0ZXJuIHRvIGVkaXRcclxuICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IG9wdGlvbnMuZXhpc3RpbmdCb3VuZGFyeSAtIEV4aXN0aW5nIGJvdW5kYXJ5IG1hc2sgdG8gZWRpdFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5EcmF3aW5nRWRpdG9yKG9wdGlvbnMgPSB7fSkge1xyXG4gIGNvbnN0IHsgZXhpc3RpbmdTZWVkID0gbnVsbCwgZXhpc3RpbmdCb3VuZGFyeSA9IG51bGwgfSA9IG9wdGlvbnM7XHJcbiAgXHJcbiAgLy8gQ3JlYXRlIG1vZGFsIGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuICBpZiAoIW1vZGFsKSB7XHJcbiAgICBjcmVhdGVNb2RhbCgpO1xyXG4gIH1cclxuICBcclxuICAvLyBJbml0aWFsaXplIGNhbnZhc2VzXHJcbiAgaW5pdGlhbGl6ZUNhbnZhc2VzKCk7XHJcbiAgXHJcbiAgLy8gU2V0dXAgZXZlbnQgbGlzdGVuZXJzIChtdXN0IGJlIGFmdGVyIGluaXRpYWxpemVDYW52YXNlcywgb25seSBvbmNlKVxyXG4gIGlmICghZXZlbnRMaXN0ZW5lcnNTZXR1cCkge1xyXG4gICAgc2V0dXBFdmVudExpc3RlbmVycygpO1xyXG4gICAgZXZlbnRMaXN0ZW5lcnNTZXR1cCA9IHRydWU7XHJcbiAgfVxyXG4gIFxyXG4gIC8vIExvYWQgZXhpc3RpbmcgZGF0YSBpZiBwcm92aWRlZFxyXG4gIGlmIChleGlzdGluZ1NlZWQpIHtcclxuICAgIGxvYWRTZWVkRGF0YShleGlzdGluZ1NlZWQpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBjbGVhckxheWVyKCdzZWVkJyk7XHJcbiAgfVxyXG4gIFxyXG4gIGlmIChleGlzdGluZ0JvdW5kYXJ5KSB7XHJcbiAgICBsb2FkQm91bmRhcnlEYXRhKGV4aXN0aW5nQm91bmRhcnkpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBjbGVhckxheWVyKCdib3VuZGFyeScpO1xyXG4gIH1cclxuICBcclxuICAvLyBTYXZlIGluaXRpYWwgc3RhdGUgdG8gaGlzdG9yeVxyXG4gIHNhdmVUb0hpc3RvcnkoKTtcclxuICBcclxuICAvLyBTaG93IG1vZGFsXHJcbiAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICBcclxuICAvLyBVcGRhdGUgY29tcG9zaXRlIHZpZXdcclxuICB1cGRhdGVDb21wb3NpdGUoKTtcclxuICBcclxuICBjb25zb2xlLmxvZygnRHJhd2luZyBlZGl0b3Igb3BlbmVkJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDbG9zZSB0aGUgZHJhd2luZyBlZGl0b3IgbW9kYWxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9zZURyYXdpbmdFZGl0b3IoKSB7XHJcbiAgaWYgKG1vZGFsKSB7XHJcbiAgICBtb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSB0aGUgbW9kYWwgSFRNTCBzdHJ1Y3R1cmVcclxuICovXHJcbmZ1bmN0aW9uIGNyZWF0ZU1vZGFsKCkge1xyXG4gIG1vZGFsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgbW9kYWwuaWQgPSAnZHJhd2luZy1lZGl0b3ItbW9kYWwnO1xyXG4gIG1vZGFsLmNsYXNzTmFtZSA9ICdkcmF3aW5nLWVkaXRvci1tb2RhbCc7XHJcbiAgXHJcbiAgbW9kYWwuaW5uZXJIVE1MID0gYFxyXG4gICAgPGRpdiBjbGFzcz1cImRyYXdpbmctZWRpdG9yLWNvbnRhaW5lclwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZHJhd2luZy1lZGl0b3ItaGVhZGVyXCI+XHJcbiAgICAgICAgPGgyPkRyYXdpbmcgRWRpdG9yPC9oMj5cclxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnV0dG9uXCIgaWQ9XCJkcmF3aW5nLWVkaXRvci1jbG9zZVwiPuKclTwvYnV0dG9uPlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJkcmF3aW5nLWVkaXRvci1jb250cm9sc1wiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+XHJcbiAgICAgICAgICA8bGFiZWw+QWN0aXZlIExheWVyOjwvbGFiZWw+XHJcbiAgICAgICAgICA8c2VsZWN0IGlkPVwiZHJhd2luZy1sYXllci1zZWxlY3RcIj5cclxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInNlZWRcIj5TZWVkIFBhdHRlcm4gKEdyZWVuKTwvb3B0aW9uPlxyXG4gICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiYm91bmRhcnlcIj5Cb3VuZGFyeSBXYWxscyAoUmVkKSAtIEVyYXNlIHRvIGFsbG93IHBhdHRlcm48L29wdGlvbj5cclxuICAgICAgICAgIDwvc2VsZWN0PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+XHJcbiAgICAgICAgICA8bGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImRyYXdpbmctc2hvdy1zZWVkXCIgY2hlY2tlZD5cclxuICAgICAgICAgICAgU2hvdyBTZWVkIExheWVyXHJcbiAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgPGxhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJkcmF3aW5nLXNob3ctYm91bmRhcnlcIiBjaGVja2VkPlxyXG4gICAgICAgICAgICBTaG93IEJvdW5kYXJ5IExheWVyXHJcbiAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+XHJcbiAgICAgICAgICA8bGFiZWw+VG9vbDo8L2xhYmVsPlxyXG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInRvb2wtYnV0dG9uIGFjdGl2ZVwiIGRhdGEtdG9vbD1cImJydXNoXCI+8J+WjO+4jyBEcmF3IFdhbGw8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJ0b29sLWJ1dHRvblwiIGRhdGEtdG9vbD1cImVyYXNlclwiPvCfp7kgRXJhc2UgKEFsbG93IFBhdHRlcm4pPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgXHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRyb2wtZ3JvdXBcIj5cclxuICAgICAgICAgIDxsYWJlbD5CcnVzaCBTaXplOiA8c3BhbiBpZD1cImRyYXdpbmctYnJ1c2gtc2l6ZS12YWx1ZVwiPjIwPC9zcGFuPnB4PC9sYWJlbD5cclxuICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBpZD1cImRyYXdpbmctYnJ1c2gtc2l6ZVwiIG1pbj1cIjFcIiBtYXg9XCIxMDBcIiB2YWx1ZT1cIjIwXCI+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICBcclxuICAgICAgPGRpdiBjbGFzcz1cImRyYXdpbmctY2FudmFzLWNvbnRhaW5lclwiPlxyXG4gICAgICAgIDxjYW52YXMgaWQ9XCJkcmF3aW5nLWNhbnZhcy1jb21wb3NpdGVcIj48L2NhbnZhcz5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIFxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZHJhd2luZy1lZGl0b3ItYWN0aW9uc1wiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tZ3JvdXBcIj5cclxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLXVuZG9cIj7ihrYgVW5kbzwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctcmVkb1wiPuKGtyBSZWRvPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uIGlkPVwiZHJhd2luZy1jbGVhci1sYXllclwiPkNsZWFyIExheWVyPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgXHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1ncm91cFwiPlxyXG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctaW1wb3J0LXNlZWRcIj7wn5OBIEltcG9ydCBTZWVkIEltYWdlPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uIGlkPVwiZHJhd2luZy1pbXBvcnQtYm91bmRhcnlcIj7wn5OBIEltcG9ydCBCb3VuZGFyeSBJbWFnZTwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tZ3JvdXBcIj5cclxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWV4cG9ydC1zZWVkXCI+8J+SviBFeHBvcnQgU2VlZDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctZXhwb3J0LWJvdW5kYXJ5XCI+8J+SviBFeHBvcnQgQm91bmRhcnk8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICBcclxuICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWdyb3VwIHByaW1hcnlcIj5cclxuICAgICAgICAgIDxidXR0b24gaWQ9XCJkcmF3aW5nLWNhbmNlbFwiPkNhbmNlbDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiBpZD1cImRyYXdpbmctYXBwbHlcIiBjbGFzcz1cInByaW1hcnktYnV0dG9uXCI+QXBwbHkgdG8gU2ltdWxhdGlvbjwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGA7XHJcbiAgXHJcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtb2RhbCk7XHJcbiAgXHJcbiAgLy8gQ3JlYXRlIGhpZGRlbiBmaWxlIGlucHV0cyBmb3IgaW1wb3J0XHJcbiAgY29uc3Qgc2VlZEZpbGVJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgc2VlZEZpbGVJbnB1dC50eXBlID0gJ2ZpbGUnO1xyXG4gIHNlZWRGaWxlSW5wdXQuaWQgPSAnZHJhd2luZy1zZWVkLWZpbGUtaW5wdXQnO1xyXG4gIHNlZWRGaWxlSW5wdXQuYWNjZXB0ID0gJ2ltYWdlLyonO1xyXG4gIHNlZWRGaWxlSW5wdXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNlZWRGaWxlSW5wdXQpO1xyXG4gIFxyXG4gIGNvbnN0IGJvdW5kYXJ5RmlsZUlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBib3VuZGFyeUZpbGVJbnB1dC50eXBlID0gJ2ZpbGUnO1xyXG4gIGJvdW5kYXJ5RmlsZUlucHV0LmlkID0gJ2RyYXdpbmctYm91bmRhcnktZmlsZS1pbnB1dCc7XHJcbiAgYm91bmRhcnlGaWxlSW5wdXQuYWNjZXB0ID0gJ2ltYWdlLyonO1xyXG4gIGJvdW5kYXJ5RmlsZUlucHV0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChib3VuZGFyeUZpbGVJbnB1dCk7XHJcbiAgXHJcbiAgLy8gTk9URTogRXZlbnQgbGlzdGVuZXJzIHdpbGwgYmUgc2V0IHVwIGFmdGVyIGNhbnZhc2VzIGFyZSBpbml0aWFsaXplZFxyXG59XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZSBjYW52YXMgZWxlbWVudHNcclxuICovXHJcbmZ1bmN0aW9uIGluaXRpYWxpemVDYW52YXNlcygpIHtcclxuICBjb25zdCB3aWR0aCA9IHBhcmFtZXRlclZhbHVlcy5jYW52YXMud2lkdGg7XHJcbiAgY29uc3QgaGVpZ2h0ID0gcGFyYW1ldGVyVmFsdWVzLmNhbnZhcy5oZWlnaHQ7XHJcbiAgXHJcbiAgLy8gQ29tcG9zaXRlIGNhbnZhcyAodmlzaWJsZSlcclxuICBjb21wb3NpdGVDYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1jYW52YXMtY29tcG9zaXRlJyk7XHJcbiAgY29tcG9zaXRlQ2FudmFzLndpZHRoID0gd2lkdGg7XHJcbiAgY29tcG9zaXRlQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuICBjb21wb3NpdGVDdHggPSBjb21wb3NpdGVDYW52YXMuZ2V0Q29udGV4dCgnMmQnLCB7IHdpbGxSZWFkRnJlcXVlbnRseTogdHJ1ZSB9KTtcclxuICBcclxuICAvLyBTZWVkIGxheWVyIChvZmZzY3JlZW4pXHJcbiAgc2VlZENhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gIHNlZWRDYW52YXMud2lkdGggPSB3aWR0aDtcclxuICBzZWVkQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuICBzZWVkQ3R4ID0gc2VlZENhbnZhcy5nZXRDb250ZXh0KCcyZCcsIHsgd2lsbFJlYWRGcmVxdWVudGx5OiB0cnVlIH0pO1xyXG4gIFxyXG4gIC8vIEJvdW5kYXJ5IGxheWVyIChvZmZzY3JlZW4pXHJcbiAgYm91bmRhcnlDYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuICBib3VuZGFyeUNhbnZhcy53aWR0aCA9IHdpZHRoO1xyXG4gIGJvdW5kYXJ5Q2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuICBib3VuZGFyeUN0eCA9IGJvdW5kYXJ5Q2FudmFzLmdldENvbnRleHQoJzJkJywgeyB3aWxsUmVhZEZyZXF1ZW50bHk6IHRydWUgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXR1cCBhbGwgZXZlbnQgbGlzdGVuZXJzXHJcbiAqL1xyXG5mdW5jdGlvbiBzZXR1cEV2ZW50TGlzdGVuZXJzKCkge1xyXG4gIC8vIENsb3NlIGJ1dHRvblxyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWVkaXRvci1jbG9zZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2xvc2VEcmF3aW5nRWRpdG9yKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1jYW5jZWwnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNsb3NlRHJhd2luZ0VkaXRvcik7XHJcbiAgXHJcbiAgLy8gTGF5ZXIgc2VsZWN0aW9uXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctbGF5ZXItc2VsZWN0JykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGUpID0+IHtcclxuICAgIGN1cnJlbnRMYXllciA9IGUudGFyZ2V0LnZhbHVlO1xyXG4gICAgdXBkYXRlQ29tcG9zaXRlKCk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgLy8gTGF5ZXIgdmlzaWJpbGl0eSB0b2dnbGVzXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctc2hvdy1zZWVkJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGUpID0+IHtcclxuICAgIHNob3dTZWVkID0gZS50YXJnZXQuY2hlY2tlZDtcclxuICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLXNob3ctYm91bmRhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xyXG4gICAgc2hvd0JvdW5kYXJ5ID0gZS50YXJnZXQuY2hlY2tlZDtcclxuICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIC8vIFRvb2wgc2VsZWN0aW9uXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRvb2wtYnV0dG9uJykuZm9yRWFjaChidG4gPT4ge1xyXG4gICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRvb2wtYnV0dG9uJykuZm9yRWFjaChiID0+IGIuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJykpO1xyXG4gICAgICBlLnRhcmdldC5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcclxuICAgICAgY3VycmVudFRvb2wgPSBlLnRhcmdldC5kYXRhc2V0LnRvb2w7XHJcbiAgICB9KTtcclxuICB9KTtcclxuICBcclxuICAvLyBCcnVzaCBzaXplXHJcbiAgY29uc3QgYnJ1c2hTaXplU2xpZGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZScpO1xyXG4gIGNvbnN0IGJydXNoU2l6ZVZhbHVlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZS12YWx1ZScpO1xyXG4gIGJydXNoU2l6ZVNsaWRlci5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIChlKSA9PiB7XHJcbiAgICBicnVzaFNpemUgPSBwYXJzZUludChlLnRhcmdldC52YWx1ZSk7XHJcbiAgICBicnVzaFNpemVWYWx1ZS50ZXh0Q29udGVudCA9IGJydXNoU2l6ZTtcclxuICB9KTtcclxuICBcclxuICAvLyBEcmF3aW5nIG9uIGNvbXBvc2l0ZSBjYW52YXNcclxuICBjb21wb3NpdGVDYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgc3RhcnREcmF3aW5nKTtcclxuICBjb21wb3NpdGVDYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgZHJhdyk7XHJcbiAgY29tcG9zaXRlQ2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBzdG9wRHJhd2luZyk7XHJcbiAgY29tcG9zaXRlQ2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCBzdG9wRHJhd2luZyk7XHJcbiAgXHJcbiAgLy8gVW5kby9SZWRvXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctdW5kbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdW5kbyk7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctcmVkbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcmVkbyk7XHJcbiAgXHJcbiAgLy8gQ2xlYXIgbGF5ZXJcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1jbGVhci1sYXllcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgY2xlYXJMYXllcihjdXJyZW50TGF5ZXIpO1xyXG4gICAgc2F2ZVRvSGlzdG9yeSgpO1xyXG4gICAgdXBkYXRlQ29tcG9zaXRlKCk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgLy8gSW1wb3J0XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctaW1wb3J0LXNlZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLXNlZWQtZmlsZS1pbnB1dCcpLmNsaWNrKCk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctaW1wb3J0LWJvdW5kYXJ5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1ib3VuZGFyeS1maWxlLWlucHV0JykuY2xpY2soKTtcclxuICB9KTtcclxuICBcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZy1zZWVkLWZpbGUtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xyXG4gICAgaW1wb3J0SW1hZ2UoZS50YXJnZXQuZmlsZXNbMF0sICdzZWVkJyk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYm91bmRhcnktZmlsZS1pbnB1dCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XHJcbiAgICBpbXBvcnRJbWFnZShlLnRhcmdldC5maWxlc1swXSwgJ2JvdW5kYXJ5Jyk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgLy8gRXhwb3J0XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctZXhwb3J0LXNlZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGV4cG9ydExheWVyKCdzZWVkJykpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWV4cG9ydC1ib3VuZGFyeScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gZXhwb3J0TGF5ZXIoJ2JvdW5kYXJ5JykpO1xyXG4gIFxyXG4gIC8vIEFwcGx5XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYXBwbHknKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFwcGx5RHJhd2luZyk7XHJcbiAgXHJcbiAgLy8gS2V5Ym9hcmQgc2hvcnRjdXRzXHJcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUtleWJvYXJkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhhbmRsZSBrZXlib2FyZCBzaG9ydGN1dHNcclxuICovXHJcbmZ1bmN0aW9uIGhhbmRsZUtleWJvYXJkKGUpIHtcclxuICAvLyBPbmx5IGhhbmRsZSBpZiBtb2RhbCBpcyBvcGVuXHJcbiAgaWYgKCFtb2RhbCB8fCBtb2RhbC5zdHlsZS5kaXNwbGF5ID09PSAnbm9uZScpIHJldHVybjtcclxuICBcclxuICBpZiAoZS5rZXkgPT09ICdiJyB8fCBlLmtleSA9PT0gJ0InKSB7XHJcbiAgICBjdXJyZW50VG9vbCA9ICdicnVzaCc7XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS10b29sPVwiYnJ1c2hcIl0nKS5jbGljaygpO1xyXG4gIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdlJyB8fCBlLmtleSA9PT0gJ0UnKSB7XHJcbiAgICBjdXJyZW50VG9vbCA9ICdlcmFzZXInO1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdG9vbD1cImVyYXNlclwiXScpLmNsaWNrKCk7XHJcbiAgfSBlbHNlIGlmIChlLmN0cmxLZXkgJiYgZS5rZXkgPT09ICd6Jykge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgdW5kbygpO1xyXG4gIH0gZWxzZSBpZiAoZS5jdHJsS2V5ICYmIGUua2V5ID09PSAneScpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHJlZG8oKTtcclxuICB9IGVsc2UgaWYgKGUua2V5ID09PSAnWycpIHtcclxuICAgIGJydXNoU2l6ZSA9IE1hdGgubWF4KDEsIGJydXNoU2l6ZSAtIDUpO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZScpLnZhbHVlID0gYnJ1c2hTaXplO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyYXdpbmctYnJ1c2gtc2l6ZS12YWx1ZScpLnRleHRDb250ZW50ID0gYnJ1c2hTaXplO1xyXG4gIH0gZWxzZSBpZiAoZS5rZXkgPT09ICddJykge1xyXG4gICAgYnJ1c2hTaXplID0gTWF0aC5taW4oMTAwLCBicnVzaFNpemUgKyA1KTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJydXNoLXNpemUnKS52YWx1ZSA9IGJydXNoU2l6ZTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmF3aW5nLWJydXNoLXNpemUtdmFsdWUnKS50ZXh0Q29udGVudCA9IGJydXNoU2l6ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdGFydCBkcmF3aW5nXHJcbiAqL1xyXG5mdW5jdGlvbiBzdGFydERyYXdpbmcoZSkge1xyXG4gIGlzRHJhd2luZyA9IHRydWU7XHJcbiAgY29uc3QgcmVjdCA9IGNvbXBvc2l0ZUNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICBjb25zdCB4ID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xyXG4gIGNvbnN0IHkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcclxuICBkcmF3UG9pbnQoeCwgeSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEcmF3IHdoaWxlIG1vdmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gZHJhdyhlKSB7XHJcbiAgaWYgKCFpc0RyYXdpbmcpIHJldHVybjtcclxuICBcclxuICBjb25zdCByZWN0ID0gY29tcG9zaXRlQ2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gIGNvbnN0IHggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XHJcbiAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xyXG4gIGRyYXdQb2ludCh4LCB5KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFN0b3AgZHJhd2luZ1xyXG4gKi9cclxuZnVuY3Rpb24gc3RvcERyYXdpbmcoKSB7XHJcbiAgaWYgKGlzRHJhd2luZykge1xyXG4gICAgaXNEcmF3aW5nID0gZmFsc2U7XHJcbiAgICBzYXZlVG9IaXN0b3J5KCk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRHJhdyBhIHBvaW50IG9uIHRoZSBhY3RpdmUgbGF5ZXJcclxuICovXHJcbmZ1bmN0aW9uIGRyYXdQb2ludCh4LCB5KSB7XHJcbiAgY29uc3QgY3R4ID0gY3VycmVudExheWVyID09PSAnc2VlZCcgPyBzZWVkQ3R4IDogYm91bmRhcnlDdHg7XHJcbiAgXHJcbiAgY3R4Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IGN1cnJlbnRUb29sID09PSAnYnJ1c2gnID8gJ3NvdXJjZS1vdmVyJyA6ICdkZXN0aW5hdGlvbi1vdXQnO1xyXG4gIGN0eC5maWxsU3R5bGUgPSAnIzAwMCc7XHJcbiAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gIGN0eC5hcmMoeCwgeSwgYnJ1c2hTaXplIC8gMiwgMCwgTWF0aC5QSSAqIDIpO1xyXG4gIGN0eC5maWxsKCk7XHJcbiAgXHJcbiAgdXBkYXRlQ29tcG9zaXRlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgdGhlIGNvbXBvc2l0ZSBjYW52YXMgdmlld1xyXG4gKi9cclxuZnVuY3Rpb24gdXBkYXRlQ29tcG9zaXRlKCkge1xyXG4gIC8vIENsZWFyIGNvbXBvc2l0ZSB3aXRoIHdoaXRlIGJhY2tncm91bmRcclxuICBjb21wb3NpdGVDdHguZmlsbFN0eWxlID0gJyNmZmYnO1xyXG4gIGNvbXBvc2l0ZUN0eC5maWxsUmVjdCgwLCAwLCBjb21wb3NpdGVDYW52YXMud2lkdGgsIGNvbXBvc2l0ZUNhbnZhcy5oZWlnaHQpO1xyXG4gIFxyXG4gIC8vIERyYXcgc2VlZCBsYXllciAoYmxhY2sgb24gd2hpdGUpIHdpdGggZ3JlZW4gdGludFxyXG4gIGlmIChzaG93U2VlZCkge1xyXG4gICAgY29tcG9zaXRlQ3R4Lmdsb2JhbEFscGhhID0gMS4wO1xyXG4gICAgY29tcG9zaXRlQ3R4Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9ICdzb3VyY2Utb3Zlcic7XHJcbiAgICBcclxuICAgIC8vIERyYXcgc2VlZCBjYW52YXNcclxuICAgIGNvbXBvc2l0ZUN0eC5kcmF3SW1hZ2Uoc2VlZENhbnZhcywgMCwgMCk7XHJcbiAgICBcclxuICAgIC8vIEFwcGx5IGdyZWVuIHRpbnQgdG8gYmxhY2sgYXJlYXNcclxuICAgIGNvbXBvc2l0ZUN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnbXVsdGlwbHknO1xyXG4gICAgY29tcG9zaXRlQ3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDEwMCwgMjU1LCAxMDAsIDEuMCknO1xyXG4gICAgY29tcG9zaXRlQ3R4LmZpbGxSZWN0KDAsIDAsIGNvbXBvc2l0ZUNhbnZhcy53aWR0aCwgY29tcG9zaXRlQ2FudmFzLmhlaWdodCk7XHJcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcclxuICB9XHJcbiAgXHJcbiAgLy8gRHJhdyBib3VuZGFyeSBsYXllciAoYmxhY2sgb24gdHJhbnNwYXJlbnQpIHdpdGggcmVkIHRpbnRcclxuICBpZiAoc2hvd0JvdW5kYXJ5KSB7XHJcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQWxwaGEgPSAxLjA7XHJcbiAgICBjb21wb3NpdGVDdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIGEgdGVtcG9yYXJ5IGNhbnZhcyB0byBhcHBseSByZWQgdGludCB0byBib3VuZGFyeVxyXG4gICAgY29uc3QgdGVtcENhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gICAgdGVtcENhbnZhcy53aWR0aCA9IGJvdW5kYXJ5Q2FudmFzLndpZHRoO1xyXG4gICAgdGVtcENhbnZhcy5oZWlnaHQgPSBib3VuZGFyeUNhbnZhcy5oZWlnaHQ7XHJcbiAgICBjb25zdCB0ZW1wQ3R4ID0gdGVtcENhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgXHJcbiAgICAvLyBEcmF3IGJvdW5kYXJ5IGNhbnZhc1xyXG4gICAgdGVtcEN0eC5kcmF3SW1hZ2UoYm91bmRhcnlDYW52YXMsIDAsIDApO1xyXG4gICAgXHJcbiAgICAvLyBDaGFuZ2UgYmxhY2sgcGl4ZWxzIHRvIHJlZFxyXG4gICAgdGVtcEN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnc291cmNlLWluJztcclxuICAgIHRlbXBDdHguZmlsbFN0eWxlID0gJ3JnYmEoMjU1LCA1MCwgNTAsIDAuNyknO1xyXG4gICAgdGVtcEN0eC5maWxsUmVjdCgwLCAwLCB0ZW1wQ2FudmFzLndpZHRoLCB0ZW1wQ2FudmFzLmhlaWdodCk7XHJcbiAgICBcclxuICAgIC8vIERyYXcgdGludGVkIGJvdW5kYXJ5IHRvIGNvbXBvc2l0ZVxyXG4gICAgY29tcG9zaXRlQ3R4LmRyYXdJbWFnZSh0ZW1wQ2FudmFzLCAwLCAwKTtcclxuICAgIGNvbXBvc2l0ZUN0eC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSAnc291cmNlLW92ZXInO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENsZWFyIGEgc3BlY2lmaWMgbGF5ZXJcclxuICovXHJcbi8qKlxyXG4gKiBDbGVhciBhIGxheWVyXHJcbiAqL1xyXG5mdW5jdGlvbiBjbGVhckxheWVyKGxheWVyKSB7XHJcbiAgY29uc3QgY3R4ID0gbGF5ZXIgPT09ICdzZWVkJyA/IHNlZWRDdHggOiBib3VuZGFyeUN0eDtcclxuICBcclxuICBpZiAobGF5ZXIgPT09ICdzZWVkJykge1xyXG4gICAgLy8gU2VlZCBsYXllcjogd2hpdGUgYmFja2dyb3VuZCAobm8gc2VlZCBwYXR0ZXJuKVxyXG4gICAgY3R4LmZpbGxTdHlsZSA9ICcjZmZmJztcclxuICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjdHguY2FudmFzLndpZHRoLCBjdHguY2FudmFzLmhlaWdodCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIEJvdW5kYXJ5IGxheWVyOiBmdWxsIGJsYWNrIChhbGwgY29uc3RyYWluZWQgLSB1c2VyIGVyYXNlcyB0byBhbGxvdyBwYXR0ZXJuKVxyXG4gICAgY3R4LmZpbGxTdHlsZSA9ICcjMDAwJztcclxuICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjdHguY2FudmFzLndpZHRoLCBjdHguY2FudmFzLmhlaWdodCk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTG9hZCBzZWVkIGRhdGEgZnJvbSBJbWFnZURhdGFcclxuICovXHJcbmZ1bmN0aW9uIGxvYWRTZWVkRGF0YShpbWFnZURhdGEpIHtcclxuICBzZWVkQ3R4LnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xyXG59XHJcblxyXG4vKipcclxuICogTG9hZCBib3VuZGFyeSBkYXRhIGZyb20gRmxvYXQzMkFycmF5XHJcbiAqL1xyXG5mdW5jdGlvbiBsb2FkQm91bmRhcnlEYXRhKGJvdW5kYXJ5QXJyYXkpIHtcclxuICBjb25zdCB3aWR0aCA9IGJvdW5kYXJ5Q2FudmFzLndpZHRoO1xyXG4gIGNvbnN0IGhlaWdodCA9IGJvdW5kYXJ5Q2FudmFzLmhlaWdodDtcclxuICBjb25zdCBpbWFnZURhdGEgPSBib3VuZGFyeUN0eC5jcmVhdGVJbWFnZURhdGEod2lkdGgsIGhlaWdodCk7XHJcbiAgXHJcbiAgLy8gQ29udmVydCBGbG9hdDMyQXJyYXkgKDAuMC0xLjApIHRvIFJHQkFcclxuICBmb3IgKGxldCBpID0gMDsgaSA8IGJvdW5kYXJ5QXJyYXkubGVuZ3RoOyBpKyspIHtcclxuICAgIGNvbnN0IHZhbHVlID0gYm91bmRhcnlBcnJheVtpXSA+IDAuNSA/IDAgOiAyNTU7ICAvLyBCbGFjayA9IGluc2lkZSwgd2hpdGUgPSBvdXRzaWRlXHJcbiAgICBpbWFnZURhdGEuZGF0YVtpICogNF0gPSB2YWx1ZTtcclxuICAgIGltYWdlRGF0YS5kYXRhW2kgKiA0ICsgMV0gPSB2YWx1ZTtcclxuICAgIGltYWdlRGF0YS5kYXRhW2kgKiA0ICsgMl0gPSB2YWx1ZTtcclxuICAgIGltYWdlRGF0YS5kYXRhW2kgKiA0ICsgM10gPSAyNTU7XHJcbiAgfVxyXG4gIFxyXG4gIGJvdW5kYXJ5Q3R4LnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xyXG59XHJcblxyXG4vKipcclxuICogU2F2ZSBjdXJyZW50IHN0YXRlIHRvIGhpc3RvcnlcclxuICovXHJcbmZ1bmN0aW9uIHNhdmVUb0hpc3RvcnkoKSB7XHJcbiAgLy8gVHJ1bmNhdGUgaGlzdG9yeSBpZiB3ZSdyZSBub3QgYXQgdGhlIGVuZFxyXG4gIGlmIChoaXN0b3J5SW5kZXggPCBzZWVkSGlzdG9yeS5sZW5ndGggLSAxKSB7XHJcbiAgICBzZWVkSGlzdG9yeSA9IHNlZWRIaXN0b3J5LnNsaWNlKDAsIGhpc3RvcnlJbmRleCArIDEpO1xyXG4gICAgYm91bmRhcnlIaXN0b3J5ID0gYm91bmRhcnlIaXN0b3J5LnNsaWNlKDAsIGhpc3RvcnlJbmRleCArIDEpO1xyXG4gIH1cclxuICBcclxuICAvLyBBZGQgY3VycmVudCBzdGF0ZVxyXG4gIHNlZWRIaXN0b3J5LnB1c2goc2VlZEN0eC5nZXRJbWFnZURhdGEoMCwgMCwgc2VlZENhbnZhcy53aWR0aCwgc2VlZENhbnZhcy5oZWlnaHQpKTtcclxuICBib3VuZGFyeUhpc3RvcnkucHVzaChib3VuZGFyeUN0eC5nZXRJbWFnZURhdGEoMCwgMCwgYm91bmRhcnlDYW52YXMud2lkdGgsIGJvdW5kYXJ5Q2FudmFzLmhlaWdodCkpO1xyXG4gIFxyXG4gIGhpc3RvcnlJbmRleCsrO1xyXG4gIFxyXG4gIC8vIExpbWl0IGhpc3Rvcnkgc2l6ZVxyXG4gIGlmIChzZWVkSGlzdG9yeS5sZW5ndGggPiBNQVhfSElTVE9SWSkge1xyXG4gICAgc2VlZEhpc3Rvcnkuc2hpZnQoKTtcclxuICAgIGJvdW5kYXJ5SGlzdG9yeS5zaGlmdCgpO1xyXG4gICAgaGlzdG9yeUluZGV4LS07XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogVW5kbyBsYXN0IGFjdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gdW5kbygpIHtcclxuICBpZiAoaGlzdG9yeUluZGV4ID4gMCkge1xyXG4gICAgaGlzdG9yeUluZGV4LS07XHJcbiAgICBzZWVkQ3R4LnB1dEltYWdlRGF0YShzZWVkSGlzdG9yeVtoaXN0b3J5SW5kZXhdLCAwLCAwKTtcclxuICAgIGJvdW5kYXJ5Q3R4LnB1dEltYWdlRGF0YShib3VuZGFyeUhpc3RvcnlbaGlzdG9yeUluZGV4XSwgMCwgMCk7XHJcbiAgICB1cGRhdGVDb21wb3NpdGUoKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWRvIGxhc3QgdW5kb25lIGFjdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gcmVkbygpIHtcclxuICBpZiAoaGlzdG9yeUluZGV4IDwgc2VlZEhpc3RvcnkubGVuZ3RoIC0gMSkge1xyXG4gICAgaGlzdG9yeUluZGV4Kys7XHJcbiAgICBzZWVkQ3R4LnB1dEltYWdlRGF0YShzZWVkSGlzdG9yeVtoaXN0b3J5SW5kZXhdLCAwLCAwKTtcclxuICAgIGJvdW5kYXJ5Q3R4LnB1dEltYWdlRGF0YShib3VuZGFyeUhpc3RvcnlbaGlzdG9yeUluZGV4XSwgMCwgMCk7XHJcbiAgICB1cGRhdGVDb21wb3NpdGUoKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbXBvcnQgaW1hZ2UgZmlsZVxyXG4gKi9cclxuZnVuY3Rpb24gaW1wb3J0SW1hZ2UoZmlsZSwgbGF5ZXIpIHtcclxuICBpZiAoIWZpbGUpIHJldHVybjtcclxuICBcclxuICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG4gIHJlYWRlci5vbmxvYWQgPSAoZSkgPT4ge1xyXG4gICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XHJcbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xyXG4gICAgICBjb25zdCBjdHggPSBsYXllciA9PT0gJ3NlZWQnID8gc2VlZEN0eCA6IGJvdW5kYXJ5Q3R4O1xyXG4gICAgICBcclxuICAgICAgLy8gRHJhdyBpbWFnZSB0byBsYXllciBjYW52YXNcclxuICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjZmZmJztcclxuICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGN0eC5jYW52YXMud2lkdGgsIGN0eC5jYW52YXMuaGVpZ2h0KTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNjYWxlIGltYWdlIHRvIGZpdCBjYW52YXNcclxuICAgICAgY29uc3Qgc2NhbGUgPSBNYXRoLm1pbihcclxuICAgICAgICBjdHguY2FudmFzLndpZHRoIC8gaW1nLndpZHRoLFxyXG4gICAgICAgIGN0eC5jYW52YXMuaGVpZ2h0IC8gaW1nLmhlaWdodFxyXG4gICAgICApO1xyXG4gICAgICBjb25zdCB4ID0gKGN0eC5jYW52YXMud2lkdGggLSBpbWcud2lkdGggKiBzY2FsZSkgLyAyO1xyXG4gICAgICBjb25zdCB5ID0gKGN0eC5jYW52YXMuaGVpZ2h0IC0gaW1nLmhlaWdodCAqIHNjYWxlKSAvIDI7XHJcbiAgICAgIFxyXG4gICAgICBjdHguZHJhd0ltYWdlKGltZywgeCwgeSwgaW1nLndpZHRoICogc2NhbGUsIGltZy5oZWlnaHQgKiBzY2FsZSk7XHJcbiAgICAgIFxyXG4gICAgICBzYXZlVG9IaXN0b3J5KCk7XHJcbiAgICAgIHVwZGF0ZUNvbXBvc2l0ZSgpO1xyXG4gICAgICBcclxuICAgICAgY29uc29sZS5sb2coYEltcG9ydGVkIGltYWdlIHRvICR7bGF5ZXJ9IGxheWVyYCk7XHJcbiAgICB9O1xyXG4gICAgaW1nLnNyYyA9IGUudGFyZ2V0LnJlc3VsdDtcclxuICB9O1xyXG4gIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xyXG59XHJcblxyXG4vKipcclxuICogRXhwb3J0IGxheWVyIGFzIFBOR1xyXG4gKi9cclxuZnVuY3Rpb24gZXhwb3J0TGF5ZXIobGF5ZXIpIHtcclxuICBjb25zdCBjYW52YXMgPSBsYXllciA9PT0gJ3NlZWQnID8gc2VlZENhbnZhcyA6IGJvdW5kYXJ5Q2FudmFzO1xyXG4gIGNvbnN0IGRhdGFVUkwgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9wbmcnKTtcclxuICBcclxuICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gIGxpbmsuZG93bmxvYWQgPSBgJHtsYXllcn0tJHtEYXRlLm5vdygpfS5wbmdgO1xyXG4gIGxpbmsuaHJlZiA9IGRhdGFVUkw7XHJcbiAgbGluay5jbGljaygpO1xyXG4gIFxyXG4gIGNvbnNvbGUubG9nKGBFeHBvcnRlZCAke2xheWVyfSBsYXllcmApO1xyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgZHJhd2luZyB0byBzaW11bGF0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiBhcHBseURyYXdpbmcoKSB7XHJcbiAgLy8gR2V0IHNlZWQgZGF0YVxyXG4gIGNvbnN0IHNlZWRJbWFnZURhdGEgPSBzZWVkQ3R4LmdldEltYWdlRGF0YSgwLCAwLCBzZWVkQ2FudmFzLndpZHRoLCBzZWVkQ2FudmFzLmhlaWdodCk7XHJcbiAgXHJcbiAgLy8gR2V0IGJvdW5kYXJ5IGRhdGFcclxuICBjb25zdCBib3VuZGFyeUltYWdlRGF0YSA9IGJvdW5kYXJ5Q3R4LmdldEltYWdlRGF0YSgwLCAwLCBib3VuZGFyeUNhbnZhcy53aWR0aCwgYm91bmRhcnlDYW52YXMuaGVpZ2h0KTtcclxuICBcclxuICAvLyBDaGVjayBpZiBib3VuZGFyeSBoYXMgYW55IGNvbnRlbnQgKG5vbi10cmFuc3BhcmVudCBwaXhlbHMpXHJcbiAgbGV0IGhhc0JvdW5kYXJ5Q29udGVudCA9IGZhbHNlO1xyXG4gIGZvciAobGV0IGkgPSAzOyBpIDwgYm91bmRhcnlJbWFnZURhdGEuZGF0YS5sZW5ndGg7IGkgKz0gNCkge1xyXG4gICAgaWYgKGJvdW5kYXJ5SW1hZ2VEYXRhLmRhdGFbaV0gPiAxMjgpIHsgIC8vIEFscGhhIGNoYW5uZWwgPiAxMjhcclxuICAgICAgaGFzQm91bmRhcnlDb250ZW50ID0gdHJ1ZTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8vIFN0b3JlIGluIGdsb2JhbCBmb3IgYWNjZXNzIGJ5IGZpcnN0RnJhbWUuanNcclxuICBnbG9iYWwuY3VzdG9tRHJhd2luZ1NlZWQgPSBzZWVkSW1hZ2VEYXRhO1xyXG4gIGdsb2JhbC5jdXN0b21EcmF3aW5nQm91bmRhcnkgPSBib3VuZGFyeUltYWdlRGF0YTtcclxuICBcclxuICAvLyBJZiBib3VuZGFyeSBoYXMgY29udGVudCwgZW5hYmxlIGJvdW5kYXJ5IGNvbmRpdGlvbnNcclxuICBpZiAoaGFzQm91bmRhcnlDb250ZW50KSB7XHJcbiAgICBwYXJhbWV0ZXJWYWx1ZXMuYm91bmRhcnkuZW5hYmxlZCA9IHRydWU7XHJcbiAgICBjb25zb2xlLmxvZygnQm91bmRhcnkgZHJhd2luZyBkZXRlY3RlZCAtIGVuYWJsaW5nIGJvdW5kYXJ5IGNvbmRpdGlvbnMnKTtcclxuICB9XHJcbiAgXHJcbiAgLy8gQ2xvc2UgbW9kYWxcclxuICBjbG9zZURyYXdpbmdFZGl0b3IoKTtcclxuICBcclxuICAvLyBBcHBseSB0byBzaW11bGF0aW9uXHJcbiAgZHJhd0ZpcnN0RnJhbWUoSW5pdGlhbFRleHR1cmVUeXBlcy5EUkFXSU5HKTtcclxuICBcclxuICBjb25zb2xlLmxvZygnQXBwbGllZCBkcmF3aW5nIHRvIHNpbXVsYXRpb24nLCB7XHJcbiAgICBoYXNCb3VuZGFyeTogaGFzQm91bmRhcnlDb250ZW50LFxyXG4gICAgYm91bmRhcnlFbmFibGVkOiBwYXJhbWV0ZXJWYWx1ZXMuYm91bmRhcnkuZW5hYmxlZFxyXG4gIH0pO1xyXG59XHJcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==