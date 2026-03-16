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
    title: "Save Image As…",
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
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [info.srcUrl, format.mimeType, format.ext, format.id],
      func: convertImage,
    });

    if (results?.[0]?.result?.error) {
      console.error("Conversion error:", results[0].result.error);
      return;
    }

    const { dataUrl, filename } = results[0].result;

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    });
  } catch (err) {
    console.error("Save As Image Type error:", err);
  }
});

function convertImage(srcUrl, mimeType, ext, formatId) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
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

      // Derive filename from URL
      let baseName = "image";
      try {
        const urlPath = new URL(srcUrl).pathname;
        const lastSegment = urlPath.split("/").pop();
        if (lastSegment) {
          baseName = lastSegment.replace(/\.[^.]+$/, "") || "image";
          // Sanitize
          baseName = baseName.replace(/[^a-zA-Z0-9_\-]/g, "_");
        }
      } catch {}

      resolve({ dataUrl, filename: baseName + ext });
    };

    img.onerror = () => {
      // Fallback: try fetching as blob directly
      fetch(srcUrl)
        .then((r) => r.blob())
        .then((blob) => createImageBitmap(blob))
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

          let baseName = "image";
          try {
            const urlPath = new URL(srcUrl).pathname;
            const lastSegment = urlPath.split("/").pop();
            if (lastSegment) {
              baseName = lastSegment.replace(/\.[^.]+$/, "") || "image";
              baseName = baseName.replace(/[^a-zA-Z0-9_\-]/g, "_");
            }
          } catch {}

          resolve({ dataUrl, filename: baseName + ext });
        })
        .catch((err) => {
          resolve({ error: err.message });
        });
    };

    img.src = srcUrl;
  });
}
