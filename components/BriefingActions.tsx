"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBriefing } from "@/app/actions/reporting";

export default function BriefingActions({ briefingId }: { briefingId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteBriefing(briefingId);
    router.push("/briefings");
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/briefings/${briefingId}/edit`}
        className="text-xs bg-[#1F3864] text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-[#2a4a7f]"
      >
        ✏️ 수정
      </a>

      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600 font-medium">정말 삭제할까요?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "삭제중…" : "삭제"}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors"
        >
          🗑 삭제
        </button>
      )}
    </div>
  );
}
