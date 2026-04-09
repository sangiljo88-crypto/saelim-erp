"use client";

import { useState } from "react";

type AccountGroup = { label: string; color: string; accounts: { role: string; id: string; pw: string }[] };

const ACCOUNT_GROUPS: AccountGroup[] = [
  {
    label: "경영진",
    color: "bg-[#1F3864] text-white",
    accounts: [
      { role: "대표이사",  id: "ceo",      pw: "saelim2026" },
      { role: "COO",       id: "coo",      pw: "saelim2026" },
    ],
  },
  {
    label: "팀장 · 관리자",
    color: "bg-blue-600 text-white",
    accounts: [
      { role: "공장장 (생산팀)",    id: "factory",   pw: "team2026" },
      { role: "가공팀장",           id: "process",   pw: "team2026" },
      { role: "스킨팀장",           id: "skin",      pw: "team2026" },
      { role: "재고담당",           id: "stock",     pw: "team2026" },
      { role: "품질팀장",           id: "quality",   pw: "team2026" },
      { role: "배송팀장",           id: "delivery",  pw: "team2026" },
      { role: "CS팀장",             id: "cs",        pw: "team2026" },
      { role: "마케팅팀장",         id: "marketing", pw: "team2026" },
      { role: "회계팀장",           id: "account",   pw: "team2026" },
      { role: "온라인팀장",         id: "online",    pw: "team2026" },
      { role: "개발이사",           id: "dev",       pw: "team2026" },
    ],
  },
  {
    label: "작업자",
    color: "bg-emerald-600 text-white",
    accounts: [
      { role: "생산팀 (김현수)",  id: "w_prod1", pw: "1234" },
      { role: "생산팀 (이민준)",  id: "w_prod2", pw: "1234" },
      { role: "가공팀 (박서연)",  id: "w_proc1", pw: "1234" },
      { role: "가공팀 (최태양)",  id: "w_proc2", pw: "1234" },
      { role: "스킨팀 (정하늘)",  id: "w_skin1", pw: "1234" },
      { role: "품질팀 (한지수)",  id: "w_qual1", pw: "1234" },
      { role: "배송팀 (오성민)",  id: "w_del1",  pw: "1234" },
      { role: "CS팀 (윤미래)",    id: "w_cs1",   pw: "1234" },
    ],
  },
];

export default function TestAccountsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors"
      >
        <span>테스트 계정 목록 (개발용)</span>
        <span className="text-gray-300 ml-2">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {ACCOUNT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded mb-1 inline-block ${group.color}`}>
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700 w-32 shrink-0">{acc.role}</span>
                    <span className="font-mono text-gray-600">{acc.id} / {acc.pw}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
