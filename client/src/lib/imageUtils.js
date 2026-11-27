export const MAX_INLINE_IMAGE_BYTES = 60 * 1024; // Keeps JSON payloads safely below Express's default 100 KB limit

export function validatePhotoValueForApi(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if (/^data:image\//i.test(trimmed)) {
    if (trimmed.length > MAX_INLINE_IMAGE_BYTES) {
      throw new Error(
        `Inline image data (${Math.round(trimmed.length / 1024)} KB) exceeds the ${Math.round(MAX_INLINE_IMAGE_BYTES / 1024)} KB limit supported by the JSON API. Please pick a smaller image or provide an http(s) image URL.`
      );
    }
    return trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Please enter a valid http(s) image URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Image URL must start with http:// or https://.');
  }

  return trimmed;
}

export async function compressImageFileToDataUrl(
  file,
  { maxDimension = 720, maxBytes = MAX_INLINE_IMAGE_BYTES } = {}
) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Please select a valid image file (JPG, PNG, or WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to read the selected image file.'));
      el.src = objectUrl;
    });

    const attempts = [
      { dim: maxDimension, quality: 0.72 },
      { dim: maxDimension, quality: 0.54 },
      { dim: Math.min(maxDimension, 520), quality: 0.42 },
      { dim: Math.min(maxDimension, 380), quality: 0.3 }
    ];

    for (const { dim, quality } of attempts) {
      const scale = Math.min(1, dim / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round((img.width || dim) * scale));
      const height = Math.max(1, Math.round((img.height || dim) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser canvas is unavailable for image compression.');
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxBytes) {
        return dataUrl;
      }
    }

    throw new Error(
      `Selected image could not be compressed under ${Math.round(maxBytes / 1024)} KB for the backend JSON API. Please paste an external http(s) image URL instead.`
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
