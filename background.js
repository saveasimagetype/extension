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
    // Fetch image in background (no CORS restrictions here)
    const response = await fetch(info.srcUrl);
    const blob = await response.blob();

    // Decode image using createImageBitmap (available in service workers)
    const bitmap = await createImageBitmap(blob);

    // Use OffscreenCanvas (available in service workers, no DOM needed)
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

    // OffscreenCanvas.convertToBlob supports fewer types than toDataURL
    // Supported: image/png, image/jpeg, image/webp
    let outputMime = format.mimeType;
    if (outputMime === "image/gif" || outputMime === "image/bmp") {
      outputMime = "image/png";
    }

    const quality =
      format.id === "jpeg" || format.id === "webp" ? 0.92 : undefined;

    const outputBlob = await canvas.convertToBlob({
      type: outputMime,
      quality,
    });

    // Convert blob to data URL (FileReader not available in service workers)
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
