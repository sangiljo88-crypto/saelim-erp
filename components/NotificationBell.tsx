"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification,
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

const typeIcon: Record<string, string> = {
  urgent: "!",
  warning: "!",
  success: "v",
  info: "i",
};

const typeColor: Record<string, string> = {
  urgent: "bg-red-100 text-red-600",
  warning: "bg-amber-100 text-amber-600",
  success: "bg-emerald-100 text-emerald-600",
  info: "bg-blue-100 text-blue-600",
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [count, items] = await Promise.all([
        getUnreadCount(userId),
        getNotifications(userId, 10),
      ]);
      setUnreadCount(count);
      setNotifications(items);
    } catch {
      // silent
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // 30초마다 새로고침
    return () => clearInterval(interval);
  }, [refresh]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    await markAllAsRead(userId);
    await refresh();
  };

  const handleClickNotification = async (notif: Notification) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    setOpen(false);
    if (notif.link) {
      window.location.href = notif.link;
    } else {
      await refresh();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-blue-200 hover:text-white transition-colors p-1"
        aria-label="알림"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="text-sm font-bold text-gray-800">알림</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  모두 읽음
                </button>
              )}
              <a
                href="/settings/notifications"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setOpen(false)}
              >
                알림 설정
              </a>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">
                알림이 없습니다
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !n.is_read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* 타입 아이콘 */}
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                        typeColor[n.type] ?? typeColor.info
                      }`}
                    >
                      {typeIcon[n.type] ?? "i"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {n.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <span className="text-[11px] text-gray-400 mt-1 block">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
