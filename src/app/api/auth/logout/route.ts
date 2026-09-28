import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/cookies";
import { getSessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) {
    await audit({ actorId: user.id, companyId: user.companyId, action: "USER_LOGOUT", entity: "User", entityId: user.id });
  }
  return NextResponse.json({ ok: true });
}
