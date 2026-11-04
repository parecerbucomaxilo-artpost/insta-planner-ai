import { getLogoOptions, type LogoKey } from "./logos-catalog";

/** Browser-only composition of original files; never redraw or recolor a logo. */
export async function carregarLogoStudio(key: LogoKey): Promise<HTMLImageElement | null> {
  const options = getLogoOptions([key]);
  if (!options.length) return null;
  const load = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar todos os logos oficiais."));
    image.src = src;
  });
  const images = await Promise.all(options.map(option => load(option.url)));
  if (images.length === 1) return images[0];
  const height = 440;
  const gap = 80;
  const widths = images.map(image => Math.round(image.width / image.height * height));
  const canvas = document.createElement("canvas");
  canvas.width = widths.reduce((total, width) => total + width, 0) + gap * (images.length - 1);
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível combinar os logos oficiais.");
  let x = 0;
  images.forEach((image, index) => {
    ctx.drawImage(image, x, 0, widths[index], height);
    x += widths[index] + gap;
  });
  return load(canvas.toDataURL("image/png"));
}