"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMeeting } from "@/app/actions/meetings";

/** 회의록 상세 하단 COO 전용 삭제 버튼 (브리핑 BriefingActions 패턴) */
export default function MeetingActions({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await deleteMeeting(meetingId);
    if (res.success) {
      router.push("/meetings");
    } else {
      setError(res.error ?? "삭제 실패");
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      {confirming ? (
        <>
          <span className="text-xs text-red-500 font-medium">정말 삭제할까요?</span>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "삭제중…" : "삭제"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            취소
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors"
        >
          🗑 삭제
        </button>
      )}
    </div>
  );
}
