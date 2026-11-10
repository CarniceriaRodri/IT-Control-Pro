/**
 * OCR y reconocimiento local en navegador. Los scripts, datos de idioma y el
 * núcleo WebAssembly se sirven desde el MISMO origen que IT Control Pro.
 * En Android quedan dentro del alcance de la PWA para uso sin Internet.
 */
type TesseractWorker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};
type TesseractApi = {
  createWorker: (language: string, oem?: number, options?: {
    workerPath?: string; corePath?: string; langPath?: string;
    workerBlobURL?: boolean;
  }) => Promise<TesseractWorker>;
};
declare global {
  interface Window { Tesseract?: TesseractApi; }
}
let loader: Promise<TesseractApi> | undefined;
const local = (name: string) => new URL("./ocr/" + name, document.baseURI).href;
function getTesseract(): Promise<TesseractApi> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loader) return loader;
  loader = new Promise<TesseractApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = local("tesseract.min.js");
    script.async = true;
    script.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(Error("No se pudo iniciar el motor OCR local."));
    script.onerror = () => reject(Error(
      "No están disponibles los archivos OCR locales. Instala o actualiza el paquete Android completo."
    ));
    document.head.append(script);
  }).catch((error: unknown) => { loader = undefined; throw error; });
  return loader;
}
export async function recognizeOcr(photo: Blob): Promise<string> {
  const engine = await getTesseract();
  const worker = await engine.createWorker("spa+eng", 1, {
    workerPath: local("worker.min.js"),
    corePath: local("core"),
    langPath: local("lang"),
    workerBlobURL: false,
  });
  try {
    const result = await worker.recognize(photo);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
type BarcodeReader = {
  detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string; format?: string }>>;
};
type BarcodeReaderConstructor = new () => BarcodeReader;
export async function readCodes(photo: Blob): Promise<string[]> {
  const NativeReader = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeReaderConstructor }).BarcodeDetector;
  if (!NativeReader || typeof createImageBitmap !== "function")
    throw Error("Este navegador no admite la lectura local de códigos. Puedes usar OCR.");
  const bitmap = await createImageBitmap(photo);
  try {
    const found = await new NativeReader().detect(bitmap);
    return [...new Set(found.map((item) => item.rawValue.trim()).filter(Boolean))];
  } finally {
    bitmap.close();
  }
}
