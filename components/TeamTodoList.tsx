"use client";

import { useState, useEffect, useRef } from "react";

interface Todo { text: string; defaultDone?: boolean }

interface StoredTodo {
  text: string;
  done: boolean;
  custom?: boolean; // 팀장이 직접 추가한 항목
}

interface Props {
  dept: string;
  todos: Todo[];
}

function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

export default function TeamTodoList({ dept, todos }: Props) {
  const storageKey = `todos-${dept}-${getWeekKey()}`;

  const [items, setItems] = useState<StoredTodo[]>(() =>
    todos.map((t) => ({ text: t.text, done: t.defaultDone ?? false }))
  );
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // localStorage에서 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: StoredTodo[] = JSON.parse(saved);
        // 기본 항목은 유지하되, 저장된 상태(done) 반영 + 커스텀 항목 추가
        const defaultTexts = new Set(todos.map((t) => t.text));
        const base = todos.map((t) => {
          const found = parsed.find((p) => p.text === t.text);
          return { text: t.text, done: found?.done ?? t.defaultDone ?? false };
        });
        const custom = parsed.filter((p) => p.custom);
        setItems([...base, ...custom]);
      }
    } catch {}
    setLoaded(true);
  }, [storageKey]);

  // 변경 시 저장
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}
  }, [items, storageKey, loaded]);

  // 추가 인풋 포커스
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function toggle(i: number) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, done: !item.done } : item));
  }

  function addTodo() {
    const text = newText.trim();
    if (!text) return;
    setItems((prev) => [...prev, { text, done: false, custom: true }]);
    setNewText("");
    setAdding(false);
  }

  function removeTodo(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const doneCount = items.filter((t) => t.done).length;
  const total = items.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 진행률 바 */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>주간 진행률</span>
          <span className="font-semibold text-gray-600">{doneCount}/{total}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 할 일 목록 */}
      <div className="divide-y divide-gray-100">
        {items.map((todo, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-gray-50 transition-colors">
            {/* 체크 버튼 */}
            <button
              type="button"
              onClick={() => toggle(i)}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                todo.done
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-300 hover:border-emerald-400"
              }`}
            >
              {todo.done && <span className="text-white text-[10px] font-bold">✓</span>}
            </button>

            {/* 텍스트 */}
            <span className={`text-sm flex-1 transition-colors ${
              todo.done ? "line-through text-gray-400" : "text-gray-700"
            }`}>
              {todo.text}
              {todo.custom && (
                <span className="ml-1.5 text-[10px] text-gray-300 font-medium">추가됨</span>
              )}
            </span>

            {/* 삭제 버튼 (커스텀 항목만 또는 호버시) */}
            <button
              type="button"
              onClick={() => removeTodo(i)}
              className="shrink-0 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer text-lg leading-none"
              title="삭제"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 새 항목 입력 */}
      {adding ? (
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTodo();
              if (e.key === "Escape") { setAdding(false); setNewText(""); }
            }}
            placeholder="할 일 입력 후 Enter..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:border-[#1F3864] outline-none"
          />
          <button
            onClick={addTodo}
            disabled={!newText.trim()}
            className="text-xs bg-[#1F3864] text-white px-3 py-2 rounded-lg font-semibold disabled:opacity-40 hover:bg-[#162c52] transition-colors cursor-pointer"
          >
            추가
          </button>
          <button
            onClick={() => { setAdding(false); setNewText(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 cursor-pointer"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-5 py-3 border-t border-gray-100 text-sm text-gray-400 hover:text-[#1F3864] hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">+</span>
          <span>할 일 추가</span>
        </button>
      )}

      {/* 완료 메시지 */}
      {doneCount === total && total > 0 && (
        <div className="bg-emerald-50 border-t border-emerald-100 px-5 py-3 text-center">
          <span className="text-xs font-semibold text-emerald-600">
            🎉 이번 주 할 일 모두 완료!
          </span>
        </div>
      )}
    </div>
  );
}
