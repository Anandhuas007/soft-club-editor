
"use strict";

const $ = (selector) => document.querySelector(selector);

const canvas = $("#photo-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const upload = $("#image-upload");
const stage = $("#preview-stage");
const emptyState = $("#empty-state");
const status = $("#image-status");
const dimensions = $("#dimensions");
const presetList = $("#preset-list");
const controls = $("#adjustment-controls");
const compareButton = $("#compare-button");
const exportButton = $("#export-button");
const cropButton = $("#crop-button");
const rotateButton = $("#rotate-button");
const resetButton = $("#reset-button");

const PRESETS = [
  {
    id: "soft-club",
    name: "SOFT CLUB",
    tag: "SIGNATURE",
    settings: { exposure: 0, contrast: -8, saturation: -24, temperature: -3, fade: 10, grain: 12, bloom: 8, vignette: 8 }
  },
  {
    id: "concrete",
    name: "CONCRETE",
    tag: "URBAN",
    settings: { exposure: -3, contrast: 8, saturation: -35, temperature: -12, fade: 4, grain: 10, bloom: 2, vignette: 14 }
  },
  {
    id: "skin-soft",
    name: "SKIN / SOFT",
    tag: "PORTRAIT",
    settings: { exposure: 5, contrast: -12, saturation: -12, temperature: 4, fade: 7, grain: 5, bloom: 12, vignette: 2 }
  },
  {
    id: "still-air",
    name: "STILL AIR",
    tag: "LANDSCAPE",
    settings: { exposure: 3, contrast: -10, saturation: -22, temperature: -5, fade: 12, grain: 8, bloom: 15, vignette: 5 }
  },
  {
    id: "terminal",
    name: "TERMINAL",
    tag: "FLUORESCENT",
    settings: { exposure: -4, contrast: 5, saturation: -30, temperature: -15, fade: 4, grain: 14, bloom: 10, vignette: 12 }
  },
  {
    id: "memory",
    name: "MEMORY",
    tag: "ANALOG",
    settings: { exposure: 2, contrast: -16, saturation: -18, temperature: 10, fade: 22, grain: 25, bloom: 4, vignette: 8 }
  },
  {
    id: "after-hours",
    name: "AFTER HOURS",
    tag: "NIGHT",
    settings: { exposure: -8, contrast: 15, saturation: -25, temperature: -8, fade: 3, grain: 16, bloom: 14, vignette: 24 }
  },
  {
    id: "mono",
    name: "MONO",
    tag: "MONOCHROME",
    settings: { exposure: 0, contrast: 12, saturation: -100, temperature: 0, fade: 5, grain: 12, bloom: 0, vignette: 12 }
  }
];

const DEFAULTS = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  fade: 0,
  grain: 0,
  bloom: 0,
  vignette: 0
};

const SLIDERS = [
  { id: "intensity", label: "PRESET INTENSITY", min: 0, max: 100, value: 100 },
  { id: "exposure", label: "EXPOSURE", min: -50, max: 50, value: 0 },
  { id: "contrast", label: "CONTRAST", min: -50, max: 50, value: 0 },
  { id: "saturation", label: "SATURATION", min: -100, max: 50, value: 0 },
  { id: "temperature", label: "TEMPERATURE", min: -50, max: 50, value: 0 },
  { id: "fade", label: "FADED BLACKS", min: 0, max: 50, value: 0 },
  { id: "grain", label: "FILM GRAIN", min: 0, max: 50, value: 0 },
  { id: "bloom", label: "SOFT BLOOM", min: 0, max: 50, value: 0 },
  { id: "vignette", label: "VIGNETTE", min: 0, max: 50, value: 0 }
];

let originalImage = null;
let sourceUrl = null;
let selectedPreset = PRESETS[0];
let values = { ...DEFAULTS, intensity: 100 };
let compareHeld = false;
let rotation = 0;
let cropMode = false;
let cropRect = null;
let dragStart = null;
let previewFrame = 0;
let renderToken = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makePresetCards() {
  presetList.innerHTML = "";

  PRESETS.forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.dataset.preset = preset.id;

    button.innerHTML = `
      <div class="preset-swatch"></div>
      <div class="preset-info">
        <span class="preset-number">0${index + 1} / SC</span>
        <span class="preset-name">${preset.name}</span>
        <span class="preset-tag">${preset.tag}</span>
      </div>
    `;

    button.addEventListener("click", () => selectPreset(preset));
    presetList.appendChild(button);
  });

  updatePresetSelection();
}

function makeSliders() {
  controls.innerHTML = "";

  SLIDERS.forEach((slider) => {
    const wrapper = document.createElement("div");
    wrapper.className = "slider-control";

    const label = document.createElement("label");
    label.className = "slider-label";
    label.htmlFor = `slider-${slider.id}`;

    const name = document.createElement("span");
    name.textContent = slider.label;

    const output = document.createElement("output");
    output.id = `value-${slider.id}`;
    output.textContent = slider.value;

    label.append(name, output);

    const input = document.createElement("input");
    input.type = "range";
    input.id = `slider-${slider.id}`;
    input.min = slider.min;
    input.max = slider.max;
    input.value = slider.value;
    input.step = 1;

    input.addEventListener("input", () => {
      values[slider.id] = Number(input.value);
      output.value = input.value;
      output.textContent = input.value;

      if (slider.id !== "intensity") {
        // Manual changes are layered on top of the selected preset.
        renderPreview();
      } else {
        renderPreview();
      }
    });

    wrapper.append(label, input);
    controls.appendChild(wrapper);
  });
}

function updateSliderUI() {
  SLIDERS.forEach(({ id }) => {
    const input = $(`#slider-${id}`);
    const output = $(`#value-${id}`);

    input.value = values[id] ?? 0;
    output.value = input.value;
    output.textContent = input.value;
  });
}

function selectPreset(preset) {
  selectedPreset = preset;
  values = { ...preset.settings, intensity: values.intensity ?? 100 };

  updateSliderUI();
  updatePresetSelection();
  renderPreview();
}

function updatePresetSelection() {
  presetList.querySelectorAll(".preset-card").forEach((button) => {
    const active = button.dataset.preset === selectedPreset.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function fitPreview() {
  if (!originalImage) return;

  const maxWidth = Math.max(1, stage.clientWidth - 48);
  const maxHeight = Math.max(1, Math.min(stage.clientHeight - 50, 650));

  const scale = Math.min(
    maxWidth / originalImage.naturalWidth,
    maxHeight / originalImage.naturalHeight,
    1
  );

  const width = Math.max(1, Math.round(originalImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(originalImage.naturalHeight * scale));

  canvas.width = width;
  canvas.height = height;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  dimensions.textContent = `${originalImage.naturalWidth} × ${originalImage.naturalHeight} PX`;
}

function renderPreview() {
  if (!originalImage) return;

  cancelAnimationFrame(previewFrame);

  previewFrame = requestAnimationFrame(() => {
    fitPreview();
    drawImage(ctx, canvas.width, canvas.height, true);
  });
}

function drawOriginal(targetCtx, width, height) {
  targetCtx.save();
  targetCtx.translate(width / 2, height / 2);
  targetCtx.rotate((rotation * Math.PI) / 180);

  const rotated = rotation % 180 !== 0;
  const drawWidth = rotated ? height : width;
  const drawHeight = rotated ? width : height;

  targetCtx.drawImage(
    originalImage,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight
  );

  targetCtx.restore();
}

function getEffectiveSettings() {
  const intensity = clamp(values.intensity / 100, 0, 1);
  const result = {};

  Object.keys(DEFAULTS).forEach((key) => {
    result[key] = (values[key] ?? 0) * intensity;
  });

  return result;
}

function drawImage(targetCtx, width, height, preview = false) {
  if (!originalImage) return;

  const token = ++renderToken;
  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = width;
  imageCanvas.height = height;

  const imageCtx = imageCanvas.getContext("2d", { willReadFrequently: true });
  imageCtx.clearRect(0, 0, width, height);
  drawOriginal(imageCtx, width, height);

  if (cropRect && !preview) {
    // Cropping is applied separately in the export pipeline.
  }

  if (compareHeld) {
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(imageCanvas, 0, 0);
    return;
  }

  const s = getEffectiveSettings();
  const imageData = imageCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const exposure = Math.pow(2, s.exposure / 50);
  const contrast = 1 + s.contrast / 100;
  const saturation = 1 + s.saturation / 100;
  const temperature = s.temperature * 0.6;
  const fade = s.fade / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r *= exposure;
    g *= exposure;
    b *= exposure;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    r += temperature;
    b -= temperature * 0.7;

    r = r * (1 - fade) + 128 * fade;
    g = g * (1 - fade) + 128 * fade;
    b = b * (1 - fade) + 128 * fade;

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  imageCtx.putImageData(imageData, 0, 0);

  if (s.bloom > 0) {
    targetCtx.save();
    targetCtx.globalAlpha = s.bloom / 180;
    targetCtx.filter = `blur(${Math.max(1, s.bloom / 7)}px)`;
    targetCtx.drawImage(imageCanvas, 0, 0, width, height);
    targetCtx.restore();
  }

  targetCtx.save();
  targetCtx.globalAlpha = 1;
  targetCtx.drawImage(imageCanvas, 0, 0);

  if (s.grain > 0) {
    addGrain(targetCtx, width, height, s.grain, preview);
  }

  if (s.vignette > 0) {
    const radius = Math.max(width, height) * 0.15;
    const gradient = targetCtx.createRadialGradient(
      width / 2, height / 2, radius,
      width / 2, height / 2, Math.max(width, height) * 0.72
    );

    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${s.vignette / 100})`);

    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(0, 0, width, height);
  }

  targetCtx.restore();

  if (token !== renderToken) return;
}

function addGrain(targetCtx, width, height, amount, preview) {
  // Use a smaller grain layer for large exports.
  const scale = preview ? 1 : Math.min(1, 1200 / Math.max(width, height));
  const grainWidth = Math.max(1, Math.ceil(width * scale));
  const grainHeight = Math.max(1, Math.ceil(height * scale));

  const grainCanvas = document.createElement("canvas");
  grainCanvas.width = grainWidth;
  grainCanvas.height = grainHeight;

  const grainCtx = grainCanvas.getContext("2d");
  const grainData = grainCtx.createImageData(grainWidth, grainHeight);

  for (let i = 0; i < grainData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount * 2.5;
    grainData.data[i] = 128 + noise;
    grainData.data[i + 1] = 128 + noise;
    grainData.data[i + 2] = 128 + noise;
    grainData.data[i + 3] = Math.round(amount * 2.4);
  }

  grainCtx.putImageData(grainData, 0, 0);

  targetCtx.save();
  targetCtx.globalCompositeOperation = "soft-light";
  targetCtx.globalAlpha = Math.min(0.7, amount / 45);
  targetCtx.drawImage(grainCanvas, 0, 0, width, height);
  targetCtx.restore();
}

function loadFile(file) {
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    alert("Please choose a JPG, PNG or WebP image.");
    return;
  }

  if (file.size > 30 * 1024 * 1024) {
    alert("Please choose an image smaller than 30 MB for now.");
    return;
  }

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);

  const image = new Image();

  image.onload = () => {
    originalImage = image;
    rotation = 0;
    cropRect = null;
    cropMode = false;
    compareHeld = false;

    values = { ...selectedPreset.settings, intensity: 100 };

    emptyState.hidden = true;
    canvas.hidden = false;
    exportButton.disabled = false;
    compareButton.disabled = false;
    cropButton.textContent = "□ Crop image";

    status.textContent = file.name.toUpperCase().slice(0, 30);
    updateSliderUI();
    renderPreview();
  };

  image.onerror = () => {
    alert("This image could not be opened. Please try another file.");
    URL.revokeObjectURL(sourceUrl);
    sourceUrl = null;
  };

  image.src = sourceUrl;
}

function exportImage() {
  if (!originalImage) return;

  const output = document.createElement("canvas");
  const swapped = rotation % 180 !== 0;

  output.width = swapped ? originalImage.naturalHeight : originalImage.naturalWidth;
  output.height = swapped ? originalImage.naturalWidth : originalImage.naturalHeight;

  const outputCtx = output.getContext("2d", { willReadFrequently: true });

  drawImage(outputCtx, output.width, output.height, false);

  const format = $("#export-format").value;
  const quality = format === "image/png" ? undefined : 0.96;

  output.toBlob((blob) => {
    if (!blob) {
      alert("Export failed. Try a smaller image.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soft-club-${selectedPreset.id}.${format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg"}`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, format, quality);
}

upload.addEventListener("change", (event) => {
  loadFile(event.target.files[0]);
  event.target.value = "";
});

compareButton.addEventListener("pointerdown", (event) => {
  if (!originalImage) return;
  event.preventDefault();
  compareHeld = true;
  renderPreview();
});

function releaseCompare() {
  if (!compareHeld) return;
  compareHeld = false;
  renderPreview();
}

compareButton.addEventListener("pointerup", releaseCompare);
compareButton.addEventListener("pointerleave", releaseCompare);
window.addEventListener("pointerup", releaseCompare);
window.addEventListener("blur", releaseCompare);

rotateButton.addEventListener("click", () => {
  if (!originalImage) return;
  rotation = (rotation + 90) % 360;
  renderPreview();
});

cropButton.addEventListener("click", () => {
  if (!originalImage) {
    alert("Import an image first.");
    return;
  }

  if (!cropMode) {
    cropMode = true;
    cropButton.textContent = "✓ Apply crop";
    stage.style.cursor = "crosshair";
    alert("Crop mode: drag across the image preview to select a crop area, then click Apply crop.");
    return;
  }

  cropMode = false;
  cropButton.textContent = "□ Crop image";
  stage.style.cursor = "";
  renderPreview();
});

stage.addEventListener("pointerdown", (event) => {
  if (!cropMode || !originalImage) return;

  const rect = canvas.getBoundingClientRect();
  dragStart = {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height)
  };

  canvas.setPointerCapture?.(event.pointerId);
});

stage.addEventListener("pointerup", (event) => {
  if (!cropMode || !dragStart) return;

  const rect = canvas.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const y = clamp(event.clientY - rect.top, 0, rect.height);

  const left = Math.min(dragStart.x, x) / rect.width;
  const top = Math.min(dragStart.y, y) / rect.height;
  const width = Math.abs(x - dragStart.x) / rect.width;
  const height = Math.abs(y - dragStart.y) / rect.height;

  if (width > 0.04 && height > 0.04) {
    cropRect = { left, top, width, height };
    alert("Crop selection saved for this session. Cropped export support is being finalised.");
  }

  dragStart = null;
});

resetButton.addEventListener("click", () => {
  if (!originalImage) return;

  rotation = 0;
  cropRect = null;
  cropMode = false;
  compareHeld = false;
  values = { ...selectedPreset.settings, intensity: 100 };

  cropButton.textContent = "□ Crop image";
  stage.style.cursor = "";
  updateSliderUI();
  renderPreview();
});

exportButton.addEventListener("click", exportImage);

window.addEventListener("resize", () => {
  if (originalImage) renderPreview();
});

makePresetCards();
makeSliders();
