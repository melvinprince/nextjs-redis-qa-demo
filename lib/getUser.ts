import { headers } from "next/headers";

export async function getUser() {
  const h = await headers();
  const uid = h.get("x-user-id");
  const email = h.get("x-user-email");
  if (!uid || !email) return null;
  return { id: uid, email };
}
