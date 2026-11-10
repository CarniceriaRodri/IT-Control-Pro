/**
 * Reconocimiento voluntario en el navegador.
 *
 * Los códigos se intentan leer mediante BarcodeDetector cuando el navegador lo ofrece.
 * OCR usa Tesseract.js descargado bajo demanda desde un CDN público; el motor trabaja
 * sobre el Blob local, sin enviar la imagen a una API OCR. No utilizar fotografías
 * corporativas hasta disponer de una distribución sin código externo y autorización.
 */
type TesseractWorker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};
type TesseractApi = {
  createWorker: (language: string, oem?: number) => Promise<TesseractWorker>;
};
declare global {
  interface Window {
    Tesseract?: TesseractApi;
  }
}
let loader: Promise<TesseractApi> | undefined;
function getTesseract(): Promise<TesseractApi> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loader) return loader;
  loader = new Promise<TesseractApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(Error("El motor OCR no se ha iniciado."));
    script.onerror = () => reject(Error("No se pudo descargar el motor OCR. Comprueba el acceso a Internet o la política de red."));
    document.head.append(script);
  }).catch((error: unknown) => {
    loader = undefined;
    throw error;
  });
  return loader;
}
export async function recognizeOcr(photo: Blob): Promise<string> {
  const engine = await getTesseract();
  const worker = await engine.createWorker("spa+eng", 1);
  try {
    const result = await worker.recognize(photo);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
type BarcodeReader = { detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string; format?: string }>> };
type BarcodeReaderConstructor = new () => BarcodeReader;
export async function readCodes(photo: Blob): Promise<string[]> {
  const NativeReader = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeReaderConstructor }).BarcodeDetector;
  if (!NativeReader || typeof createImageBitmap !== "function")
    throw Error("Este navegador no admite lectura local de QR y códigos de barras. Puedes probar OCR.");
  const bitmap = await createImageBitmap(photo);
  try {
    const found = await new NativeReader().detect(bitmap);
    return [...new Set(found.map((item) => item.rawValue.trim()).filter(Boolean))];
  } finally {
    bitmap.close();
  }
}
