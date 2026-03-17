const FORMATS = [
  { id: "png", title: "Save as PNG", mimeType: "image/png", ext: ".png" },
  { id: "jpeg", title: "Save as JPEG", mimeType: "image/jpeg", ext: ".jpg" },
  { id: "webp", title: "Save as WebP", mimeType: "image/webp", ext: ".webp" },
  { id: "avif", title: "Save as AVIF", mimeType: "image/avif", ext: ".avif" },
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
    // Inject content script to fetch image from the page context (same-origin)
    // activeTab permission is granted because the user performed a gesture (right-click)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [info.srcUrl],
      func: fetchImageAsDataUrl,
    });

    const imageDataUrl = results?.[0]?.result;
    if (!imageDataUrl) {
      console.error("Save As Image Type: failed to fetch image from page");
      return;
    }

    // Convert data URL to blob in the service worker
    const fetchResponse = await fetch(imageDataUrl);
    const blob = await fetchResponse.blob();

    // Decode and convert using OffscreenCanvas
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");

    // Formats that don't support transparency get a white background
    const needsWhiteBg =
      format.id === "jpeg" || format.id === "bmp" || format.id === "gif";
    if (needsWhiteBg) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // OffscreenCanvas.convertToBlob supports: png, jpeg, webp, avif
    // BMP and GIF are not supported — fall back to PNG encoding
    let outputMime = format.mimeType;
    if (outputMime === "image/gif" || outputMime === "image/bmp") {
      outputMime = "image/png";
    }

    const quality =
      format.id === "jpeg" || format.id === "webp" || format.id === "avif"
        ? 0.92
        : undefined;

    const outputBlob = await canvas.convertToBlob({
      type: outputMime,
      quality,
    });

    // Convert to data URL for chrome.downloads
    const arrayBuffer = await outputBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );
    const dataUrl = `data:${outputMime};base64,${base64}`;

    // Derive filename from source URL
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

// This function runs in the page context via content script injection.
// It fetches the image as a blob (same-origin, no CORS issues) and
// returns it as a data URL to the background script.
function fetchImageAsDataUrl(srcUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      // Fallback: fetch as blob directly
      fetch(srcUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    };
    img.src = srcUrl;
  });
}
