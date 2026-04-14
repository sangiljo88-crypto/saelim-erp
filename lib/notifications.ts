"use server";

import { createServerClient } from "@/lib/supabase";
import { MOCK_USERS } from "@/lib/auth";

export interface Notification {
  id: string;
  recipient_id: string;
  recipient_name: string | null;
  title: string;
  message: string;
  type: "info" | "warning" | "urgent" | "success";
  category: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ── 알림 발송 (개별) ─────────────────────────────────────────
export async function sendNotification(params: {
  recipientId: string;
  recipientName?: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "urgent" | "success";
  category?: string;
  link?: string;
}): Promise<void> {
  try {
    const db = createServerClient();
    await db.from("notifications").insert({
      recipient_id: params.recipientId,
      recipient_name: params.recipientName ?? null,
      title: params.title,
      message: params.message,
      type: params.type ?? "info",
      category: params.category ?? null,
      link: params.link ?? null,
    });
    // Future: trigger webhooks here
  } catch {
    // 알림 발송 실패가 메인 작업을 중단시키면 안 됨
  }
}

// ── 알림 발송 (복수 수신자) ──────────────────────────────────
export async function sendNotificationToMany(
  recipientIds: string[],
  params: {
    title: string;
    message: string;
    type?: "info" | "warning" | "urgent" | "success";
    category?: string;
    link?: string;
  }
): Promise<void> {
  try {
    const db = createServerClient();
    const rows = recipientIds.map((rid) => {
      const user = MOCK_USERS.find((u) => u.id === rid);
      return {
        recipient_id: rid,
        recipient_name: user?.name ?? null,
        title: params.title,
        message: params.message,
        type: params.type ?? "info",
        category: params.category ?? null,
        link: params.link ?? null,
      };
    });
    await db.from("notifications").insert(rows);
  } catch {
    // 알림 발송 실패가 메인 작업을 중단시키면 안 됨
  }
}

// ── 역할 기반 알림 발송 ──────────────────────────────────────
export async function sendNotificationToRole(
  role: string,
  params: {
    title: string;
    message: string;
    type?: "info" | "warning" | "urgent" | "success";
    category?: string;
    link?: string;
  }
): Promise<void> {
  const recipients = MOCK_USERS.filter((u) => u.role === role);
  const ids = recipients.map((u) => u.id);
  if (ids.length > 0) {
    await sendNotificationToMany(ids, params);
  }
}

// ── 읽지 않은 알림 수 조회 ───────────────────────────────────
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const db = createServerClient();
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── 알림 목록 조회 ───────────────────────────────────────────
export async function getNotifications(
  userId: string,
  limit: number = 10
): Promise<Notification[]> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Notification[];
  } catch {
    return [];
  }
}

// ── 읽음 처리 (단건) ────────────────────────────────────────
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    const db = createServerClient();
    await db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
  } catch {
    // silent
  }
}

// ── 모두 읽음 처리 ──────────────────────────────────────────
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const db = createServerClient();
    await db
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
  } catch {
    // silent
  }
}

// ── 웹훅 설정 관련 ──────────────────────────────────────────
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  headers: Record<string, string>;
  created_by: string | null;
  created_at: string;
}

export async function getWebhookConfigs(): Promise<WebhookConfig[]> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from("webhook_configs")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as WebhookConfig[];
  } catch {
    return [];
  }
}

export async function createWebhookConfig(params: {
  name: string;
  url: string;
  event_types: string[];
  headers?: Record<string, string>;
  createdBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const db = createServerClient();
    const { error } = await db.from("webhook_configs").insert({
      name: params.name,
      url: params.url,
      event_types: params.event_types,
      headers: params.headers ?? {},
      created_by: params.createdBy ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "웹훅 생성 중 오류 발생" };
  }
}

export async function deleteWebhookConfig(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = createServerClient();
    const { error } = await db.from("webhook_configs").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "웹훅 삭제 중 오류 발생" };
  }
}

export async function toggleWebhookConfig(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const db = createServerClient();
    const { error } = await db
      .from("webhook_configs")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "웹훅 상태 변경 중 오류 발생" };
  }
}
