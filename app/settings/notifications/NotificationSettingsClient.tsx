"use client";

import { useState } from "react";
import {
  markAsRead,
  markAllAsRead,
  createWebhookConfig,
  deleteWebhookConfig,
  toggleWebhookConfig,
  type Notification,
  type WebhookConfig,
} from "@/lib/notifications";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const typeLabel: Record<string, { text: string; color: string }> = {
  urgent:  { text: "긴급",   color: "bg-red-100 text-red-700" },
  warning: { text: "주의",   color: "bg-amber-100 text-amber-700" },
  success: { text: "완료",   color: "bg-emerald-100 text-emerald-700" },
  info:    { text: "알림",   color: "bg-blue-100 text-blue-700" },
};

const EVENT_TYPE_OPTIONS = [
  { value: "claim_new", label: "클레임 접수" },
  { value: "approval_request", label: "비용 승인 요청" },
  { value: "leave_request", label: "휴가 신청" },
  { value: "leave_result", label: "휴가 승인/반려" },
  { value: "inventory_low", label: "재고 부족" },
];

export default function NotificationSettingsClient({
  userId,
  initialNotifications,
  isAdmin,
  initialWebhooks,
}: {
  userId: string;
  initialNotifications: Notification[];
  isAdmin: boolean;
  initialWebhooks: WebhookConfig[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  // 웹훅 폼 상태
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([]);

  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const handleMarkAll = async () => {
    await markAllAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleMarkOne = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleAddWebhook = async () => {
    if (!whName || !whUrl || whEvents.length === 0) return;
    const result = await createWebhookConfig({
      name: whName,
      url: whUrl,
      event_types: whEvents,
      createdBy: userId,
    });
    if (result.success) {
      setShowAddWebhook(false);
      setWhName("");
      setWhUrl("");
      setWhEvents([]);
      // Reload page to get fresh data
      window.location.reload();
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("이 웹훅을 삭제하시겠습니까?")) return;
    const result = await deleteWebhookConfig(id);
    if (result.success) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const handleToggleWebhook = async (id: string, currentActive: boolean) => {
    const result = await toggleWebhookConfig(id, !currentActive);
    if (result.success) {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, is_active: !currentActive } : w))
      );
    }
  };

  return (
    <>
      {/* 알림 목록 */}
      <section className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-800">내 알림</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border overflow-hidden text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 ${filter === "all" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                전체
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 ${filter === "unread" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                읽지 않음
              </button>
            </div>
            <button
              onClick={handleMarkAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              모두 읽음 처리
            </button>
          </div>
        </div>

        <div className="divide-y max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12">
              {filter === "unread" ? "읽지 않은 알림이 없습니다" : "알림이 없습니다"}
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-3 ${!n.is_read ? "bg-blue-50/40" : ""}`}
              >
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                    typeLabel[n.type]?.color ?? typeLabel.info.color
                  }`}
                >
                  {typeLabel[n.type]?.text ?? "알림"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                    <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-gray-400">{timeAgo(n.created_at)}</span>
                    {n.category && (
                      <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 rounded">
                        {n.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkOne(n.id)}
                      className="text-xs text-gray-400 hover:text-blue-600"
                    >
                      읽음
                    </button>
                  )}
                  {n.link && (
                    <a
                      href={n.link}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      이동
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 웹훅 설정 (COO/CEO만) */}
      {isAdmin && (
        <section className="bg-white rounded-xl shadow-sm border">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-base font-bold text-gray-800">웹훅 설정</h2>
            <button
              onClick={() => setShowAddWebhook((v) => !v)}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              {showAddWebhook ? "취소" : "새 웹훅 추가"}
            </button>
          </div>

          {/* 추가 폼 */}
          {showAddWebhook && (
            <div className="px-5 py-4 border-b bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">이름</label>
                  <input
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="예: 카카오톡 알림"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">URL</label>
                  <input
                    type="url"
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">이벤트 유형</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={whEvents.includes(opt.value)}
                        onChange={(e) => {
                          setWhEvents((prev) =>
                            e.target.checked
                              ? [...prev, opt.value]
                              : prev.filter((v) => v !== opt.value)
                          );
                        }}
                        className="rounded"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleAddWebhook}
                disabled={!whName || !whUrl || whEvents.length === 0}
                className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                저장
              </button>
            </div>
          )}

          {/* 웹훅 목록 */}
          <div className="divide-y">
            {webhooks.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">
                등록된 웹훅이 없습니다
              </div>
            ) : (
              webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${wh.is_active ? "bg-emerald-400" : "bg-gray-300"}`} />
                      <span className="text-sm font-medium text-gray-800">{wh.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wh.event_types.map((et) => (
                        <span key={et} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {EVENT_TYPE_OPTIONS.find((o) => o.value === et)?.label ?? et}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleWebhook(wh.id, wh.is_active)}
                      className={`text-xs px-2 py-1 rounded ${
                        wh.is_active
                          ? "text-amber-600 hover:text-amber-800"
                          : "text-emerald-600 hover:text-emerald-800"
                      }`}
                    >
                      {wh.is_active ? "비활성화" : "활성화"}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t text-xs text-gray-400">
            웹훅은 카카오톡, 이메일 등 외부 알림 연동을 위해 사용됩니다. 이벤트 발생 시 설정된 URL로 POST 요청이 전송됩니다.
          </div>
        </section>
      )}
    </>
  );
}
