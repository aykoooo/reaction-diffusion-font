import { loadFromCanvas } from 'potrace-wasm';

/**
 * Export current simulation as SVG vector
 * @param {number} threshold - Black/white threshold (0-255)
 * @returns {Promise<string>} - SVG content as string
 */
export async function exportAsSVG(threshold = 128) {
  try {
    console.log('Capturing current canvas...');
    
    // Get current canvas directly (no scaling)
    const canvas = captureCurrentCanvas();

    console.log('Applying threshold...');
    
    // Convert to grayscale and apply threshold
    const imageData = getImageData(canvas);
    const binaryData = applyThreshold(imageData, threshold);

    // Create a temporary canvas with binary data
    const binaryCanvas = createBinaryCanvas(binaryData, canvas.width, canvas.height);

    console.log('Running Potrace...');
    
    // Convert to SVG using potrace-wasm's loadFromCanvas
    const svg = await loadFromCanvas(binaryCanvas);

    console.log('SVG generation complete');
    
    return svg;
  } catch (error) {
    console.error('SVG export failed:', error);
    throw error;
  }
}

/**
 * Capture current canvas at native resolution
 * @returns {HTMLCanvasElement} - Canvas with current simulation state
 */
function captureCurrentCanvas() {
  const sourceCanvas = global.renderer.domElement;
  
  // Create a copy of the canvas
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
  
  return canvas;
}

/**
 * Get ImageData from canvas
 * @param {HTMLCanvasElement} canvas
 * @returns {ImageData}
 */
function getImageData(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Apply threshold to create binary image
 * @param {ImageData} imageData
 * @param {number} threshold
 * @returns {Uint8ClampedArray}
 */
function applyThreshold(imageData, threshold) {
  const data = imageData.data;
  const binary = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale using luminance
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = gray > threshold ? 255 : 0;

    binary[i] = value;     // R
    binary[i + 1] = value; // G
    binary[i + 2] = value; // B
    binary[i + 3] = 255;   // A
  }

  return binary;
}

/**
 * Create canvas from binary data
 * @param {Uint8ClampedArray} binaryData
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
function createBinaryCanvas(binaryData, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(binaryData, width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Download SVG file
 * @param {string} svgContent
 * @param {string} filename
 */
export function downloadSVG(svgContent, filename = 'reaction-diffusion.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}