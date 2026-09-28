import { prisma } from "@/lib/prisma";

export interface AuditInput {
  companyId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

/** Write an audit event. Never throws — auditing must not break business flow. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}

export async function auditMany(entries: AuditInput[]): Promise<void> {
  for (const e of entries) await audit(e);
}
