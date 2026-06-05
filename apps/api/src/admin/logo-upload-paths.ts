import { join } from "node:path";

export function logoUploadDir() {
  return process.env.LOGO_UPLOAD_DIR?.trim() || join(process.cwd(), "uploads", "logos");
}

export function logoUploadUrl(fileName: string) {
  return `/api/uploads/logos/${fileName}`;
}
