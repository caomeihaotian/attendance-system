"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

interface Semester {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  courses: { id: string; name: string }[];
}

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSemesters();
  }, []);

  async function fetchSemesters() {
    const res = await fetch("/api/semesters");
    if (res.ok) setSemesters(await res.json());
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/semesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", startDate: "", endDate: "" });
      fetchSemesters();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该学期？关联的课程和数据将一并删除。")) return;
    await fetch(`/api/semesters/${id}`, { method: "DELETE" });
    fetchSemesters();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">学期管理</h1>
          <p className="text-slate-400 text-sm mt-1">管理您的教学学期</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建学期
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">新建学期</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">学期名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：2025-2026-2"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">开始日期</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">结束日期</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
              >
                {saving ? "保存中..." : "保 存"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition"
              >
                取 消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
        </div>
      ) : semesters.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-400">暂无学期，点击上方按钮创建第一个学期</p>
        </div>
      ) : (
        <div className="space-y-3">
          {semesters.map((sem) => (
            <div
              key={sem.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div>
                <h3 className="font-semibold text-white">{sem.name}</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  {sem.startDate && sem.endDate
                    ? `${format(new Date(sem.startDate), "yyyy/MM/dd")} — ${format(new Date(sem.endDate), "yyyy/MM/dd")}`
                    : "未设置日期"}
                  <span className="ml-3 text-slate-500">共 {sem.courses.length} 门课程</span>
                </p>
              </div>
              <button
                onClick={() => handleDelete(sem.id)}
                className="text-slate-500 hover:text-red-400 transition p-2 rounded-lg hover:bg-red-500/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
