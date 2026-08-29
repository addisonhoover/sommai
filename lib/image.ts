// Downscale a camera/upload data URL so menu scans travel faster
// without starving the model of readable type.

const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.76;

export function prepareScanImage(dataUrl: string): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height);
      const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
      if (scale === 1 && dataUrl.startsWith("data:image/jpeg")) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
