export function selectedDocumentUpload(formData: FormData) {
  for (const field of ["cameraDocument", "document"]) {
    const candidate = formData.get(field);
    if (candidate instanceof File && candidate.name) return candidate;
  }
  return null;
}
