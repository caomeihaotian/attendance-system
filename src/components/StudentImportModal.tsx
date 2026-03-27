"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface StudentRow {
  studentId: string;
  name: string;
  phone?: string;
  gender?: string;
  major?: string;
  adminClass?: string;
  remark?: string;
}

interface Props {
  classId: string;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
}

interface ImportResult {
  created: number;
  updated: number;
  retakes: number;
  total: number;
  errors: string[];
}

function parseRow(row: Record<string, string>): StudentRow | null {
  // Smart column name matching
  const keys = Object.keys(row);
  const find = (patterns: string[]) => {
    const key = keys.find((k) => patterns.some((p) => k.includes(p)));
    return key ? String(row[key] ?? "").trim() : "";
  };

  const studentId = find(["学号", "studentId", "student_id"]);
  const name = find(["姓名", "name", "学生姓名"]);
  const phoneRaw = find(["手机号", "手机", "电话", "phone", "mobile", "联系电话"]);

  if (!studentId || !name) return null;

  // Validate phone number if provided
  let phone: string | undefined;
  if (phoneRaw) {
    const cleaned = phoneRaw.replace(/\D/g, "");
    if (/^1[3-9]\d{9}$/.test(cleaned)) {
      phone = cleaned;
    }
  }

  return {
    studentId,
    name,
    phone,
    gender: find(["性别", "gender"]) || undefined,
    major: find(["专业", "major"]) || undefined,
    adminClass: find(["班级", "行政班", "adminClass", "class"]) || undefined,
    remark: find(["备注", "remark", "note"]) || undefined,
  };
}

export default function StudentImportModal({ classId, onClose, onSuccess }: Props) {
  const [preview, setPreview] = useState<StudentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setResult(null);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = (results.data as Record<string, string>[])
            .map(parseRow)
            .filter((r): r is StudentRow => r !== null);
          setPreview(rows);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        const rows = json.map(parseRow).filter((r): r is StudentRow => r !== null);
        setPreview(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/import-students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: preview }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        onSuccess(data);
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
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">📥 导入学生名单</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Upload */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              选择文件（支持 .xlsx / .xls / .csv）
            </label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition">
              <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-slate-400 text-sm">
                {fileName ? fileName : "点击选择或拖放文件"}
              </span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
            <p className="text-xs text-slate-500 mt-1.5">
              必须包含"学号"和"姓名"列，支持性别、专业、班级、手机号、备注列
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm text-green-400 mb-2">
                ✅ 识别到 {preview.length} 名学生（预览前10行）
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800">
                      {["学号", "姓名", "手机号", "性别", "专业", "班级", "备注"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-slate-300">{row.studentId}</td>
                        <td className="px-3 py-2 text-white font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-slate-400">{row.phone || "-"}</td>
                        <td className="px-3 py-2 text-slate-400">{row.gender}</td>
                        <td className="px-3 py-2 text-slate-400">{row.major}</td>
                        <td className="px-3 py-2 text-slate-400">{row.adminClass}</td>
                        <td className="px-3 py-2 text-orange-400">{row.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && (
                <p className="text-xs text-slate-500 mt-1">还有 {preview.length - 10} 条数据...</p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-green-300 font-medium mb-1">✅ 导入成功</p>
              <p className="text-sm text-slate-300">
                新增 <strong>{result.created}</strong> 人 ·
                更新 <strong>{result.updated}</strong> 人 ·
                重修 <strong>{result.retakes}</strong> 人 ·
                共 <strong>{result.total}</strong> 条记录
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  <p>部分记录出错：</p>
                  {result.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button
            onClick={handleImport}
            disabled={preview.length === 0 || loading || !!result}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl transition"
          >
            {loading ? "导入中..." : `导入 ${preview.length} 名学生`}
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
