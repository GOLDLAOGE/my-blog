export async function convertImageToWebp(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('只支持 JPG、PNG、WebP，不支持 GIF/SVG');
  if (file.size > 15 * 1024 * 1024) throw new Error('原图不能超过 15 MB');
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width * image.height > 50000000) throw new Error('图片像素过大，请先缩小图片');
    const scale = Math.min(1, 2560 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') throw new Error('浏览器不支持 WebP 转换，请使用最新版 Chrome');
    if (blob.size > 15 * 1024 * 1024) throw new Error('转换后的图片仍超过 15 MB');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } finally { image.close(); }
}
export function insertMarkdownImage(editor, url, alt = '') {
  const escaped = alt.replace(/[\\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
  editor.setRangeText(`\n![${escaped}](${url})\n`, editor.selectionStart, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input', { bubbles: true })); editor.focus();
}
