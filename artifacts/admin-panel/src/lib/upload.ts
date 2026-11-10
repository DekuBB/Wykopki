export async function uploadImage(file: File, endpoint: string, method = "POST"): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Wybierz zdjęcie JPG, PNG lub WebP.");
  if (file.size > 4 * 1024 * 1024 || !file.size) throw new Error("Zdjęcie musi mieć od 1 bajta do 4 MB.");
  const result = await fetch(endpoint, { method, ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) } : {}) });
  if (!result.ok) throw new Error("Nie udało się rozpocząć przesyłania zdjęcia.");
  const { uploadURL, uploadUrl } = await result.json();
  const upload = await fetch(uploadURL ?? uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!upload.ok) throw new Error("Przesyłanie zdjęcia nie powiodło się.");
  return (await upload.json()).objectPath;
}
