varying vec2 v_uv;
uniform sampler2D textureToDisplay;
uniform sampler2D previousIterationTexture;
uniform float time;
uniform int renderingStyle;
uniform float exportThreshold;
uniform float brightness;
uniform float contrast;

// Boundary overlay uniforms
uniform bool showBoundaryOverlay;
uniform sampler2D boundaryMaskDisplay;

// Color gradient stops
uniform vec4 colorStop1;
uniform vec4 colorStop2;
uniform vec4 colorStop3;
uniform vec4 colorStop4;
uniform vec4 colorStop5;

// HSL parameters
uniform vec2 hslFrom;
uniform vec2 hslTo;
uniform float hslSaturation;
uniform float hslLuminosity;

//==============================================================
//  HELPER FUNCTIONS
//==============================================================

// Conditional helpers from http://theorangeduck.com/page/avoiding-shader-conditionals
float when_gt(float x, float y) { return max(sign(x - y), 0.0); }

// Map value from one range to another
float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

// HSB to RGB conversion
vec3 hsb2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0);
  rgb = rgb*rgb*(3.0-2.0*rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Rainbow effect by Jonathon Cole
vec4 rainbow(vec2 p) {
  float red = sin(p.x) * 0.5 + 0.5;
  float green = sin(p.y) * 0.5 + 0.5;
  float blue = sin((p.x + p.y)) * 0.5 + 0.5;
  return vec4(red, green, blue, 1.0);
}

//==============================================================
//  MAIN
//==============================================================

void main() {
  vec4 pixel = texture2D(textureToDisplay, v_uv);
  vec4 previousPixel = texture2D(previousIterationTexture, v_uv);
  
  float A = pixel.r;
  float B = pixel.g;
  
  vec4 outputColor = vec4(0.0);
  
  // HSL mapping
  if(renderingStyle == 0) {
    outputColor = vec4(hsb2rgb(vec3(
      map(B-A, hslFrom[0], hslFrom[1], hslTo[0], hslTo[1]),
      hslSaturation,
      hslLuminosity
    )), 1.0);
  }
  
  // Gradient color stops
  else if(renderingStyle == 1) {
    vec3 color;
    if(B <= colorStop1.a) {
      color = colorStop1.rgb;
    } else if(B <= colorStop2.a) {
      color = mix(colorStop1.rgb, colorStop2.rgb, (B - colorStop1.a) / (colorStop2.a - colorStop1.a));
    } else if(B <= colorStop3.a) {
      color = mix(colorStop2.rgb, colorStop3.rgb, (B - colorStop2.a) / (colorStop3.a - colorStop2.a));
    } else if(B <= colorStop4.a) {
      color = mix(colorStop3.rgb, colorStop4.rgb, (B - colorStop3.a) / (colorStop4.a - colorStop3.a));
    } else {
      color = mix(colorStop4.rgb, colorStop5.rgb, (B - colorStop4.a) / (colorStop5.a - colorStop4.a));
    }
    outputColor = vec4(color, 1.0);
  }
  
  // Red Blob Games (original)
  else if(renderingStyle == 2) {
    outputColor = vec4(
      1000.0 * abs(pixel.x - previousPixel.x) + 1.0 * pixel.x - 0.5 * previousPixel.y,
      0.9 * pixel.x - 2.0 * pixel.y,
      10000.0 * abs(pixel.y - previousPixel.y),
      1.0
    );
  }
  
  // Red Blob Games (alt 1)
  else if(renderingStyle == 3) {
    outputColor = vec4(
      10000.0 * abs(pixel.y - previousPixel.y),
      1000.0 * abs(pixel.x - previousPixel.x) + 1.0 * pixel.x - 0.5 * previousPixel.y,
      0.9 * pixel.x - 2.0 * pixel.y,
      1.0
    );
  }
  
  // Red Blob Games (alt 2)
  else if(renderingStyle == 4) {
    outputColor = vec4(
      1000.0 * abs(pixel.x - previousPixel.x) + 1.0 * pixel.x - 50000.0 * previousPixel.y,
      10000.0 * abs(pixel.y - previousPixel.y),
      0.6 * pixel.x - 0.1 * pixel.y,
      1.0
    );
  }
  
  // Rainbow
  else if(renderingStyle == 5) {
    float c = A - B;
    outputColor = vec4(c, c, c, 1.0);
    vec4 rainbowColor = rainbow(v_uv.xy + time * 0.5);
    float gBranch = when_gt(B, 0.01);
    outputColor = mix(outputColor, outputColor - rainbowColor, gBranch);
  }
  
  // Black and white (soft)
  else if(renderingStyle == 6) {
    float grayValue = pixel.r - pixel.g;
    outputColor = vec4(grayValue, grayValue, grayValue, 1.0);
  }
  
  // Black and white (hard)
  else if(renderingStyle == 7) {
    float grayValue = pixel.r - pixel.g;
    if(grayValue > 0.3) {
      outputColor = vec4(1.0, 1.0, 1.0, 1.0);
    } else {
      outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }
  
  // 1-Bit Preview (with brightness/contrast for export)
  else if(renderingStyle == 8) {
    float normalized = (pixel.r - pixel.g + 1.0) * 127.5;
    float brightnessOffset = (brightness - 1.0) * 128.0;
    float adjusted = ((normalized - 128.0) * contrast) + 128.0 + brightnessOffset;
    adjusted = clamp(adjusted, 0.0, 255.0);
    float thresholded = adjusted > exportThreshold ? 1.0 : 0.0;
    outputColor = vec4(vec3(thresholded), 1.0);
  }
  
  // Raw (no processing)
  else if(renderingStyle == 9) {
    outputColor = pixel;
  }
  
  // Overlay boundary mask if enabled (for debugging)
  if(showBoundaryOverlay) {
    float boundaryValue = texture2D(boundaryMaskDisplay, v_uv).r;
    // Red tint where boundary is active (inside shape)
    if(boundaryValue > 0.5) {
      outputColor = mix(outputColor, vec4(1.0, 0.0, 0.0, 1.0), 0.3);
    }
    // Blue tint where boundary is inactive (outside shape)
    else {
      outputColor = mix(outputColor, vec4(0.0, 0.0, 1.0, 1.0), 0.15);
    }
  }
  
  gl_FragColor = outputColor;
}
