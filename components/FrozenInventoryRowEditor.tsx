"use client";

import { useState } from "react";
import { updateFrozenInventoryRow } from "@/app/actions/inventory";

interface Row {
  id: string;
  product_name: string;
  unit: string;
  prev_stock: number;
  usage_qty: number;
  incoming_qty: number;
  outgoing_qty: number;
  current_stock: number;
  modified_by?: string | null;
}

export default function FrozenInventoryRowEditor({ row }: { row: Row }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState({
    prev_stock:   row.prev_stock,
    usage_qty:    row.usage_qty,
    incoming_qty: row.incoming_qty,
    outgoing_qty: row.outgoing_qty,
    current_stock: row.current_stock,
  });
  const [modifiedBy, setModifiedBy] = useState(row.modified_by ?? null);

  function update<K extends keyof typeof vals>(k: K, v: number) {
    const next = { ...vals, [k]: v };
    next.current_stock = next.prev_stock + next.incoming_qty - next.usage_qty - next.outgoing_qty;
    setVals(next);
  }

  async function save() {
    setSaving(true);
    try {
      await updateFrozenInventoryRow(row.id, vals);
      setModifiedBy("저장됨");
      setEditing(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const numCls = "w-16 border rounded px-1 py-1 text-xs text-center outline-none focus:border-[#1F3864]";
  const cellCls = "px-2 py-2 text-center text-xs";

  if (editing) {
    return (
      <tr className="border-b border-blue-100 bg-blue-50/30">
        <td className="px-3 py-2 font-medium text-gray-800 text-xs">{row.product_name}</td>
        <td className={cellCls + " text-gray-400"}>{row.unit}</td>
        <td className={cellCls}>
          <input type="number" value={vals.prev_stock || ""} onChange={(e) => update("prev_stock", Number(e.target.value))} className={numCls} />
        </td>
        <td className={cellCls}>
          <input type="number" value={vals.usage_qty || ""} onChange={(e) => update("usage_qty", Number(e.target.value))} className={numCls} />
        </td>
        <td className={cellCls}>
          <input type="number" value={vals.incoming_qty || ""} onChange={(e) => update("incoming_qty", Number(e.target.value))} className={numCls} />
        </td>
        <td className={cellCls}>
          <input type="number" value={vals.outgoing_qty || ""} onChange={(e) => update("outgoing_qty", Number(e.target.value))} className={numCls} />
        </td>
        <td className={cellCls + " font-bold text-emerald-600"}>{vals.current_stock}</td>
        <td className="px-2 py-2 text-center">
          <div className="flex gap-1 justify-center">
            <button onClick={save} disabled={saving}
              className="text-[10px] px-2 py-1 bg-[#1F3864] text-white rounded font-semibold disabled:opacity-40 cursor-pointer">
              {saving ? "..." : "저장"}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-[10px] px-2 py-1 bg-gray-200 text-gray-600 rounded cursor-pointer">
              취소
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-3 py-2 font-medium text-gray-800 text-xs">{row.product_name}</td>
      <td className={cellCls + " text-gray-400"}>{row.unit}</td>
      <td className={cellCls + " text-gray-600"}>{vals.prev_stock}</td>
      <td className={cellCls + " text-orange-500"}>{vals.usage_qty || "-"}</td>
      <td className={cellCls + " text-blue-500"}>{vals.incoming_qty || "-"}</td>
      <td className={cellCls + " text-red-400"}>{vals.outgoing_qty || "-"}</td>
      <td className={`${cellCls} font-bold ${
        vals.current_stock < 50 && vals.current_stock > 0 ? "text-amber-600" : "text-emerald-600"
      }`}>{vals.current_stock}</td>
      <td className="px-2 py-2 text-center">
        <div className="flex items-center gap-1.5 justify-end">
          {modifiedBy && (
            <span className="text-[10px] text-blue-500 font-medium">{modifiedBy}</span>
          )}
          <button onClick={() => setEditing(true)}
            className="text-[10px] px-2 py-1 border border-gray-300 text-gray-500 rounded hover:border-[#1F3864] hover:text-[#1F3864] cursor-pointer transition-colors">
            수정
          </button>
        </div>
      </td>
    </tr>
  );
}
