"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { companies } from "./schema";
import { requireRole } from "./session";
import { putPublicObject, deletePublicObject } from "./storage";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Sniff magic bytes so a renamed .exe can't land in the public bucket just by
// lying about its Content-Type.
function looksLikeImage(buf: Buffer, type: string): boolean {
  if (type === "image/png") return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (type === "image/jpeg") return buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/webp") {
    return buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
  }
  return false;
}

export type UploadLogoResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadCompanyLogo(formData: FormData): Promise<UploadLogoResult> {
  const session = await requireRole("owner", "staff");
  if (!session.companyId) return { ok: false, error: "Sesión no válida." };
  const companyId = session.companyId;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona una imagen." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "La imagen supera los 2 MB. Reduce su tamaño e inténtalo de nuevo." };
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) return { ok: false, error: "Formato no admitido. Usa PNG, JPG o WebP." };

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, file.type)) {
    return { ok: false, error: "El archivo no parece una imagen válida." };
  }

  const [company] = await db
    .select({ logoUrl: companies.logoUrl })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return { ok: false, error: "Empresa no encontrada." };

  let url: string;
  try {
    url = await putPublicObject(`${companyId}/${crypto.randomUUID()}.${ext}`, buf, file.type);
  } catch (err) {
    console.error("logo upload failed:", err);
    return { ok: false, error: "No se pudo guardar la imagen. Inténtalo de nuevo en unos segundos." };
  }

  await db.update(companies).set({ logoUrl: url }).where(eq(companies.id, companyId));
  // The replaced logo is unreachable now; drop the object if we were hosting it.
  await deletePublicObject(company.logoUrl);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, url };
}
