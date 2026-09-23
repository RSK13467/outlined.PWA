// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/outlined.pwa/sw.js')
      .then(reg => console.log('Service Worker Registered:', reg.scope))
      .catch(err => console.error('SW Registration Failed:', err));
  });
}

// Inline Web Worker setup for background CPU processing (Sobel Filter)
const workerCode = `
  self.onmessage = function(e) {
    const { imageData, width, height, threshold, contrast, isPaper } = e.data;
    const data = imageData.data;
    const gray = new Uint8ClampedArray(width * height);

    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      let r = factor * (data[i] - 128) + 128;
      let g = factor * (data[i+1] - 128) + 128;
      let b = factor * (data[i+2] - 128) + 128;
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const output = new Uint8ClampedArray(data.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const gx = 
          -1 * gray[idx - width - 1] + 1 * gray[idx - width + 1] +
          -2 * gray[idx - 1]         + 2 * gray[idx + 1] +
          -1 * gray[idx + width - 1] + 1 * gray[idx + width + 1];

        const gy = 
          -1 * gray[idx - width - 1] - 2 * gray[idx - width] - 1 * gray[idx - width + 1] +
           1 * gray[idx + width - 1] + 2 * gray[idx + width] + 1 * gray[idx + width + 1];

        const gVal = Math.sqrt(gx * gx + gy * gy);
        const isEdge = gVal > threshold;

        const outIdx = idx * 4;
        const val = isPaper ? (isEdge ? 0 : 255) : (isEdge ? 255 : 0);

        output[outIdx]     = val;
        output[outIdx + 1] = val;
        output[outIdx + 2] = val;
        output[outIdx + 3] = 255;
      }
    }
    self.postMessage({ output: output.buffer }, [output.buffer]);
  };
`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

// UI Element Bindings
const dropzone = document.getElementById('dropzone');
const upload = document.getElementById('upload');
const threshold = document.getElementById('threshold');
const contrast = document.getElementById('contrast');
const styleMode = document.getElementById('styleMode');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const loadingSpinner = document.getElementById('loadingSpinner');

let loadedImage = null;

// Event Listeners for File Drag & Drop
dropzone.addEventListener('click', () => upload.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

upload.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    loadedImage = new Image();
    loadedImage.onload = () => {
      placeholder.style.display = 'none';
      downloadBtn.disabled = false;
      processImage();
    };
    loadedImage.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

[threshold, contrast, styleMode].forEach(el => {
  el.addEventListener('input', () => {
    document.getElementById('thresholdVal').textContent = threshold.value;
    document.getElementById('contrastVal').textContent = contrast.value;
    if (loadedImage) processImage();
  });
});

function processImage() {
  loadingSpinner.style.display = 'flex';
  const w = loadedImage.width;
  const h = loadedImage.height;
  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(loadedImage, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  worker.postMessage({
    imageData: imageData,
    width: w,
    height: h,
    threshold: parseInt(threshold.value, 10),
    contrast: parseInt(contrast.value, 10),
    isPaper: styleMode.value === 'paper'
  });
}

worker.onmessage = function(e) {
  const outputArray = new Uint8ClampedArray(e.data.output);
  const finalImgData = ctx.createImageData(canvas.width, canvas.height);
  finalImgData.data.set(outputArray);
  ctx.putImageData(finalImgData, 0, 0);
  loadingSpinner.style.display = 'none';
};

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'outlined-image.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
