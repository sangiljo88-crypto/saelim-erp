"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitBriefing } from "@/app/actions/submit";

const WEEK_LABELS = (() => {
  const labels: string[] = [];
  const now = new Date();
  for (let mo = 0; mo <= 2; mo++) {
    const d = new Date(now.getFullYear(), now.getMonth() - mo, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    for (let w = 5; w >= 1; w--) {
      labels.push(`${year}년 ${month}월 ${w}주차`);
    }
  }
  return labels;
})();

const CATEGORY_OPTIONS = [
  { value: "market", label: "업계동향" },
  { value: "weekly", label: "주간브리핑" },
];

const HTML_PLACEHOLDER = `<h2>주요 동향</h2>
<p>이번 주 육가공 업계 주요 이슈를 정리합니다.</p>

<h3>1. 돼지고기 시세</h3>
<p>전주 대비 <strong>3% 상승</strong>. 삼겹살 도매가 기준...</p>

<ul>
  <li>농협 경매가: 4,200원/kg</li>
  <li>목삼겹 경매가: 3,800원/kg</li>
</ul>

<h3>2. 주요 거래처 동향</h3>
<p>BHC·대성푸드 신규 메뉴 출시 예정...</p>

<hr />
<p><em>출처: 축산물품질평가원, 농림축산식품부</em></p>`;

export default function BriefingForm({ authorName }: { authorName: string }) {
  const router = useRouter();

  // 오늘 날짜 기반 기본 주차 라벨
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const weekNum = Math.ceil(now.getDate() / 7);
  const defaultWeekLabel = `${year}년 ${month}월 ${weekNum}주차`;

  const [form, setForm] = useState({
    week_label:   defaultWeekLabel,
    publish_date: now.toISOString().split("T")[0],
    category:     "market",
    title:        "",
    content_html: "",
    author:       authorName,
    is_pinned:    false,
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [preview, setPreview] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim())        { setError("제목을 입력해주세요"); return; }
    if (!form.content_html.trim()) { setError("내용을 입력해주세요"); return; }
    setSaving(true);
    setError("");
    try {
      const result = await submitBriefing(form);
      if (result?.id) {
        router.push(`/briefings/${result.id}`);
      } else {
        router.push("/briefings");
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-4">
        <div className="text-sm font-bold text-gray-700">기본 정보</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 주차 라벨 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">주차 라벨 *</label>
            <input
              list="week-labels"
              value={form.week_label}
              onChange={(e) => setForm((p) => ({ ...p, week_label: e.target.value }))}
              placeholder="2026년 4월 2주차"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              required
            />
            <datalist id="week-labels">
              {WEEK_LABELS.map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>

          {/* 게시 날짜 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">게시 날짜 *</label>
            <input
              type="date"
              value={form.publish_date}
              onChange={(e) => setForm((p) => ({ ...p, publish_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              required
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리 *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 작성자 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">작성자</label>
            <input
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            />
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">제목 *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="ex) 2026년 4월 2주차 돼지고기 업계 주간 브리핑"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            required
          />
        </div>

        {/* 핀 고정 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(e) => setForm((p) => ({ ...p, is_pinned: e.target.checked }))}
            className="w-4 h-4 rounded accent-[#1F3864]"
          />
          <span className="text-sm text-gray-700">📌 상단 고정 (중요 공지)</span>
        </label>
      </div>

      {/* HTML 내용 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-700">내용 (HTML) *</div>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="text-xs text-[#1F3864] hover:underline cursor-pointer"
          >
            {preview ? "✏️ 편집" : "👁 미리보기"}
          </button>
        </div>

        {preview ? (
          <div
            className="min-h-[320px] border border-gray-100 rounded-lg p-4 bg-gray-50 briefing-content"
            dangerouslySetInnerHTML={{ __html: form.content_html || "<p style='color:#9ca3af'>내용을 입력하면 여기에 미리보기가 표시됩니다.</p>" }}
          />
        ) : (
          <textarea
            value={form.content_html}
            onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
            rows={18}
            placeholder={HTML_PLACEHOLDER}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 resize-y"
            required
          />
        )}

        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          💡 HTML 태그 사용 가능:
          <code className="ml-1 text-gray-600">&lt;h2&gt; &lt;h3&gt; &lt;p&gt; &lt;strong&gt; &lt;ul&gt;&lt;li&gt; &lt;table&gt; &lt;hr&gt;</code>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#1F3864] text-white text-sm font-semibold px-8 py-2.5 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer"
        >
          {saving ? "저장중…" : "💾 브리핑 등록"}
        </button>
        <a
          href="/briefings"
          className="bg-white border border-gray-200 text-gray-600 text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-gray-50"
        >
          취소
        </a>
      </div>
    </form>
  );
}
