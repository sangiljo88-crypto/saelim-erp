"use server";

import { createServerClient } from "@/lib/supabase";

export async function logAudit(params: {
  action: "create" | "update" | "delete";
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  performedBy: string;
  performedByName: string;
  dept?: string;
}): Promise<void> {
  try {
    const db = createServerClient();
    await db.from("audit_logs").insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName ?? null,
      changes: params.changes ?? null,
      performed_by: params.performedBy,
      performed_by_name: params.performedByName,
      dept: params.dept ?? null,
    });
  } catch {
    // Audit logging must never break main operations
  }
}
