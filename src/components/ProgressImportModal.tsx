"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { format } from "date-fns";

interface SessionRow {
  title: string;
  scheduledAt: string;
  type: "THEORY" | "LAB";
  weekNumber?: number;
  lessonNumber?: number;
}

interface Props {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function parseExcelDate(value: unknown): string | null {
  if (!value) return null;
  // Excel numeric date
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  // String date
  if (typeof value === "string") {
    const str = value.trim();
    // Chinese format: 2026年3月17日 or 2026/3/17 or 2026-3-17
    const chMatch = str.match(/(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})/);
    if (chMatch) {
      return `${chMatch[1]}-${chMatch[2].padStart(2, "0")}-${chMatch[3].padStart(2, "0")}`;
    }
  }
  return null;
}

export default function ProgressImportModal({ classId, onClose, onSuccess }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [detectedType, setDetectedType] = useState<"THEORY" | "LAB" | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  function detectType(name: string): "THEORY" | "LAB" {
    if (name.includes("理论")) return "THEORY";
    if (name.includes("上机") || name.includes("实验") || name.includes("lab")) return "LAB";
    return "THEORY";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setResult(null);

    const type = detectType(file.name.toLowerCase());
    setDetectedType(type);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const workbook = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const rows: SessionRow[] = [];
      for (const row of json) {
        const keys = Object.keys(row);
        const find = (patterns: string[]) => {
          const key = keys.find((k) => patterns.some((p) => String(k).includes(p)));
          return key ? row[key] : "";
        };

        const dateVal = find(["日期", "上课日期", "date", "Date"]);
        const titleVal = find(["内容", "授课内容", "title", "主题", "题目"]);
        const weekVal = find(["周次", "week", "第"]);
        const lessonVal = find(["课次", "lesson", "序号"]);

        const scheduledAt = parseExcelDate(dateVal);
        if (!scheduledAt || !titleVal) continue;

        rows.push({
          title: String(titleVal).trim(),
          scheduledAt,
          type,
          weekNumber: weekVal ? parseInt(String(weekVal)) || undefined : undefined,
          lessonNumber: lessonVal ? parseInt(String(lessonVal)) || undefined : undefined,
        });
      }

      setSessions(rows);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (sessions.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/import-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        onSuccess();
      } else {
        setError(data.error || "导入失败");
      }
    } catch {
      setError("网络错误，请重试");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">📋 导入课程进度表</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
            <p className="font-medium mb-1">📌 格式说明</p>
            <p>Excel 文件需包含：<strong>日期</strong>、<strong>授课内容</strong> 列</p>
            <p className="mt-0.5 text-blue-400/70">文件名含"理论课"自动识别为理论课，含"上机课"自动识别为上机课</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">选择进度表文件（.xlsx / .xls / .csv）</label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-green-500/50 hover:bg-green-500/5 transition">
              <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-slate-400 text-sm">
                {fileName ? (
                  <span>
                    {fileName}
                    {detectedType && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        detectedType === "THEORY" ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"
                      }`}>
                        {detectedType === "THEORY" ? "理论课" : "上机课"}
                      </span>
                    )}
                  </span>
                ) : "点击选择文件"}
              </span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {sessions.length > 0 && (
            <div>
              <p className="text-sm text-green-400 mb-2">
                ✅ 识别到 {sessions.length} 节课（预览前8条）
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800">
                      {["日期", "类型", "授课内容", "周次"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-slate-300">
                          {format(new Date(row.scheduledAt), "MM/dd")}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 rounded text-[10px] ${
                            row.type === "THEORY" ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"
                          }`}>
                            {row.type === "THEORY" ? "理论" : "上机"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-white max-w-[200px] truncate">{row.title}</td>
                        <td className="px-3 py-2 text-slate-400">{row.weekNumber ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-green-300 font-medium">✅ 导入成功</p>
              <p className="text-sm text-slate-300 mt-1">
                新增 <strong>{result.created}</strong> 节课 · 跳过重复 <strong>{result.skipped}</strong> 节
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button
            onClick={handleImport}
            disabled={sessions.length === 0 || loading || !!result}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium rounded-xl transition"
          >
            {loading ? "导入中..." : `导入 ${sessions.length} 节课次`}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            {result ? "完成" : "取消"}
          </button>
        </div>
      </div>
    </div>
  );
}
