export function createPrecisionReadingCrop(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        // Preserve the full plot width (including the right-hand scale), while
        // removing most phone chrome and the chart app's bottom controls.
        const top = Math.round(source.naturalHeight * 0.06);
        const height = Math.round(source.naturalHeight * 0.82);
        const targetWidth = Math.min(1800, Math.max(1400, source.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = Math.round(height * targetWidth / source.naturalWidth);
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(source, 0, top, source.naturalWidth, height, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch { resolve(null); }
    };
    source.onerror = () => resolve(null);
    source.src = dataUrl;
  });
}

