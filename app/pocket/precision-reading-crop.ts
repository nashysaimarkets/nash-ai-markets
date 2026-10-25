/** Optional reading aid only: a stalled decoder must not prevent analysing the original. */
export function createPrecisionReadingCrop(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    let source: HTMLImageElement | undefined;
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (source) {
        source.onload = null;
        source.onerror = null;
        try { source.src = ""; } catch { /* Cleanup never changes the result. */ }
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8_000);
    try {
      source = new Image();
      const image = source;
      image.onload = () => {
        if (settled) return;
        try {
          if (!Number.isFinite(image.naturalWidth) || !Number.isFinite(image.naturalHeight) ||
              image.naturalWidth <= 0 || image.naturalHeight <= 0 ||
              image.naturalWidth * image.naturalHeight > 16_000_000) return finish(null);
          // Preserve the accepted full-width crop and JPEG settings.
          const top = Math.round(image.naturalHeight * 0.06);
          const height = Math.round(image.naturalHeight * 0.82);
          const targetWidth = Math.min(1800, Math.max(1400, image.naturalWidth));
          const targetHeight = Math.round(height * targetWidth / image.naturalWidth);
          if (height <= 0 || targetHeight <= 0 || targetHeight > 32_767 ||
              targetWidth * targetHeight > 16_000_000) return finish(null);
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const context = canvas.getContext("2d");
          if (!context) return finish(null);
          context.drawImage(image, 0, top, image.naturalWidth, height, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/jpeg", 0.92));
        } catch { finish(null); }
      };
      image.onerror = () => finish(null);
      image.src = dataUrl;
    } catch { finish(null); }
  });
}
