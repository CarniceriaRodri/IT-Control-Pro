"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const items = [];
  const maxSize = 10 * 1024 * 1024;
  let running = false;
  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
  const status = (target, text, error = false) => {
    target.textContent = text;
    target.className = error ? "status error" : "status";
  };
  const filename = (s) => (s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 75) || "foto");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  function download(blob, name) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function cleanImage(file) {
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw Error("No se pudo procesar la imagen");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) throw Error("No se pudo crear la imagen");
      return blob;
    } finally { URL.revokeObjectURL(source); }
  }
  function controls() {
    $("recognizeAll").disabled = !items.length || running;
    $("clearAll").disabled = !items.length || running;
    $("send").disabled = !items.length || running;
    $("photosPanel").hidden = !items.length;
  }
  function makeButton(label, action, cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener("click", action);
    return b;
  }
  function render() {
    const list = $("photosList");
    list.replaceChildren();
    items.forEach((item, index) => {
      const box = document.createElement("article");
      box.className = "photo";
      const top = document.createElement("div");
      top.className = "photoHeader";
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "Vista previa de " + item.name;
      const head = document.createElement("div");
      head.className = "photoHead";
      const strong = document.createElement("strong");
      strong.textContent = item.name;
      const small = document.createElement("small");
      small.textContent = "Captura " + (index + 1) + " · " + Math.round(item.blob.size / 1024) + " KB";
      head.append(strong, small);
      top.append(img, head);
      const body = document.createElement("div");
      body.className = "photoBody";
      const textarea = document.createElement("textarea");
      textarea.setAttribute("aria-label", "Texto OCR de " + item.name);
      textarea.placeholder = "Reconoce el texto o escríbelo aquí...";
      textarea.value = item.text;
      textarea.addEventListener("input", () => { item.text = textarea.value; });
      const row = document.createElement("div");
      row.className = "row";
      row.append(
        makeButton("Descargar foto", () => download(item.blob, item.base + ".jpg")),
        makeButton("Descargar TXT", () => download(new Blob([item.text], { type:"text/plain;charset=utf-8" }), item.base + ".txt")),
        makeButton("Quitar", () => {
          if (running) return;
          URL.revokeObjectURL(item.url);
          items.splice(index, 1);
          render();
        })
      );
      body.append(textarea, row);
      box.append(top, body);
      list.append(box);
    });
    controls();
  }
  $("photos").addEventListener("change", async (event) => {
    if (running) return;
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of files) {
      if (!file.type.startsWith("image/")) { status($("ocrStatus"), "Se ha omitido un archivo no válido: " + file.name, true); continue; }
      if (file.size > maxSize) { status($("ocrStatus"), "Archivo demasiado grande (máximo 10 MB): " + file.name, true); continue; }
      try {
        const blob = await cleanImage(file);
        const base = stamp() + "_" + String(items.length + 1).padStart(2, "0") + "_" + filename(file.name.replace(/\.[^.]+$/, ""));
        items.push({ name:file.name, base, blob, url:URL.createObjectURL(blob), text:"" });
      } catch (e) { status($("ocrStatus"), "No se pudo abrir " + file.name + ": " + String(e), true); }
    }
    render();
  });
  $("clearAll").addEventListener("click", () => {
    if (running) return;
    items.splice(0).forEach((x) => URL.revokeObjectURL(x.url));
    render();
    status($("ocrStatus"), "");
  });
  $("recognizeAll").addEventListener("click", async () => {
    if (!items.length || running) return;
    running = true; controls();
    let worker;
    try {
      if (!window.Tesseract) throw Error("No se pudo cargar el motor OCR. Se necesita conexión inicial al proveedor del OCR.");
      status($("ocrStatus"), "Descargando o preparando el motor OCR español...");
      worker = await window.Tesseract.createWorker("spa", 1, { logger: (m) => {
        if (m.status === "recognizing text") status($("ocrStatus"), "Reconociendo texto: " + Math.round(m.progress * 100) + "%");
      }});
      for (let i = 0; i < items.length; i++) {
        status($("ocrStatus"), "Procesando imagen " + (i + 1) + " de " + items.length + "...");
        const result = await worker.recognize(items[i].blob);
        items[i].text = result.data.text || "";
        render();
        await sleep(10);
      }
      status($("ocrStatus"), "OCR terminado. Revisa y corrige los textos antes de enviarlos.");
    } catch (e) { status($("ocrStatus"), "Error OCR: " + String(e), true); }
    finally {
      if (worker) await worker.terminate().catch(() => {});
      running = false; render();
    }
  });
  function inputRepo() {
    const value = $("repo").value.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.includes("..")) throw Error("Indica propietario/repositorio válido");
    return value;
  }
  async function github(method, path, token, body) {
    const response = await fetch("https://api.github.com/" + path, {
      method,
      headers: {
        "Accept":"application/vnd.github+json",
        "Authorization":"Bearer " + token,
        "X-GitHub-Api-Version":"2022-11-28",
        ...(body ? { "Content-Type":"application/json" } : {})
      },
      ...(body ? { body:JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error("GitHub " + response.status + ": " + (data.message || "Error de acceso"));
    return data;
  }
  $("send").addEventListener("click", async () => {
    if (running || !items.length) return;
    let repository, token;
    try {
      repository = inputRepo();
      token = $("token").value.trim();
      if (!token) throw Error("Necesitas un token de GitHub para este envío");
      if (!$("authorized").checked) throw Error("Confirma la autorización para usar las imágenes seleccionadas");
      if (!items.every((i) => i.text.trim())) throw Error("Revisa el texto OCR de todas las imágenes, no puede estar vacío");
    } catch (e) { status($("uploadStatus"), String(e), true); return; }
    if (!confirm("Se van a subir " + items.length + " fotos y sus textos OCR a " + repository + ". ¿Continuar?")) return;
    running = true; controls();
    $("resultSummary").replaceChildren();
    $("resultSummary").setAttribute("aria-hidden", "true");
    try {
      status($("uploadStatus"), "Verificando que el repositorio es privado...");
      const info = await github("GET", "repos/" + repository, token);
      if (info.private !== true) throw Error("El repositorio no es privado. No se ha enviado ninguna fotografía.");
      const run = stamp();
      const successes = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        for (const ext of ["jpg", "txt"]) {
          status($("uploadStatus"), "Enviando " + (i + 1) + "/" + items.length + " · " + ext + "...");
          const file = ext === "jpg" ? item.blob : new Blob([item.text], { type:"text/plain;charset=utf-8" });
          const path = "capturas/" + run + "/" + item.base + "." + ext;
          const encodedPath = path.split("/").map(encodeURIComponent).join("/");
          await github("PUT", "repos/" + repository + "/contents/" + encodedPath, token,
            { message:"Captura OCR: " + item.base + "." + ext, content:await toBase64(file) });
          successes.push(path);
        }
      }
      const summary = $("resultSummary");
      const p = document.createElement("p");
      p.textContent = "Subidos " + successes.length + " archivos a un repositorio privado.";
      const a = document.createElement("a");
      a.href = "https://github.com/" + repository + "/tree/" + info.default_branch + "/capturas/" + run;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      a.textContent = "Abrir carpeta de capturas en GitHub";
      summary.append(p, a);
      summary.setAttribute("aria-hidden", "false");
      status($("uploadStatus"), "Transferencia terminada.");
    } catch (e) {
      status($("uploadStatus"), "Transferencia interrumpida: " + String(e) + ". Revisa el repositorio: algunos archivos podrían haberse subido.", true);
    } finally {
      $("token").value = "";
      token = "";
      running = false;
      controls();
    }
  });
  render();
})();