const FORMATS = [
  { id: "png", title: "Save as PNG", mimeType: "image/png", ext: ".png" },
  { id: "jpeg", title: "Save as JPEG", mimeType: "image/jpeg", ext: ".jpg" },
  { id: "webp", title: "Save as WebP", mimeType: "image/webp", ext: ".webp" },
  { id: "bmp", title: "Save as BMP", mimeType: "image/bmp", ext: ".bmp" },
  { id: "gif", title: "Save as GIF", mimeType: "image/gif", ext: ".gif" },
];

const PARENT_ID = "saveAsImageType";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: PARENT_ID,
    title: "Save Image As\u2026",
    contexts: ["image"],
  });

  for (const fmt of FORMATS) {
    chrome.contextMenus.create({
      id: fmt.id,
      parentId: PARENT_ID,
      title: fmt.title,
      contexts: ["image"],
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const format = FORMATS.find((f) => f.id === info.menuItemId);
  if (!format) return;

  try {
    // Fetch the image in the background script to avoid CORS issues
    const response = await fetch(info.srcUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [bytes, format.mimeType, format.ext, format.id],
      func: convertImageFromBytes,
    });

    if (results?.[0]?.result?.error) {
      console.error("Conversion error:", results[0].result.error);
      return;
    }

    const { dataUrl, filename } = results[0].result;

    // Derive filename from URL
    let baseName = "image";
    try {
      const urlPath = new URL(info.srcUrl).pathname;
      const lastSegment = urlPath.split("/").pop();
      if (lastSegment) {
        baseName = lastSegment.replace(/\.[^.]+$/, "") || "image";
        baseName = baseName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      }
    } catch {}

    await chrome.downloads.download({
      url: dataUrl,
      filename: baseName + format.ext,
      saveAs: true,
    });
  } catch (err) {
    console.error("Save As Image Type error:", err);
  }
});

function convertImageFromBytes(bytes, mimeType, ext, formatId) {
  return new Promise((resolve) => {
    const uint8 = new Uint8Array(bytes);
    const blob = new Blob([uint8]);
    const blobUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");

      // JPEG doesn't support transparency — fill white background
      if (formatId === "jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      let quality = undefined;
      if (formatId === "jpeg") quality = 0.92;
      if (formatId === "webp") quality = 0.92;

      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve({ dataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      // Fallback: try createImageBitmap directly from blob
      createImageBitmap(new Blob([uint8]))
        .then((bitmap) => {
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");

          if (formatId === "jpeg") {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(bitmap, 0, 0);

          let quality = undefined;
          if (formatId === "jpeg") quality = 0.92;
          if (formatId === "webp") quality = 0.92;

          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve({ dataUrl });
        })
        .catch((err) => {
          resolve({ error: err.message });
        });
    };

    img.src = blobUrl;
  });
}
