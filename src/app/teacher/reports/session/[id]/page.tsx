"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SessionReport {
  session: {
    id: string;
    title: string;
    scheduledAt: string;
    type: string;
    course: { name: string };
    teachingClass: { name: string };
  };
  stats: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
  absentStudents: { id: string; name: string; studentId: string | null; adminClass: string | null }[];
  lateStudents: { id: string; name: string; studentId: string | null }[];
}

const COLORS = ["#22c55e", "#ef4444", "#eab308", "#3b82f6"];

export default function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/session/${id}`)
      .then((r) => r.json())
      .then(setReport)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleExport() {
    if (!report) return;
    const { default: XLSX } = await import("xlsx");
    const rows = report.absentStudents.map((s) => ({
      姓名: s.name, 学号: s.studentId, 班级: s.adminClass, 状态: "缺席",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "缺席名单");
    XLSX.writeFile(wb, `缺席名单_${report.session.title}.xlsx`);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;
  if (!report) return <div className="text-red-400 p-8">报表不存在</div>;

  const pieData = [
    { name: "出勤", value: report.stats.present },
    { name: "缺席", value: report.stats.absent },
    { name: "迟到", value: report.stats.late },
    { name: "请假", value: report.stats.excused },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/teacher/reports" className="text-slate-400 hover:text-white transition">← 返回报表</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white">{report.session.title}</span>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">{report.session.title}</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {report.session.course.name} · {report.session.teachingClass.name} ·{" "}
              {format(new Date(report.session.scheduledAt), "yyyy年MM月dd日 EEE", { locale: zhCN })}
            </p>
          </div>
          <button onClick={handleExport}
            className="px-4 py-2 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/20 rounded-lg transition">
            📤 导出缺席名单
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "出勤", value: report.stats.present, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
                { label: "缺席", value: report.stats.absent, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                { label: "迟到", value: report.stats.late, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                { label: "请假", value: report.stats.excused, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.bg} border rounded-xl p-4 text-center`}>
                  <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className={`text-4xl font-bold ${
                report.stats.rate >= 0.9 ? "text-green-400" :
                report.stats.rate >= 0.7 ? "text-yellow-400" : "text-red-400"
              }`}>
                {Math.round(report.stats.rate * 100)}%
              </div>
              <div className="text-sm text-slate-400 mt-1">出勤率（总计 {report.stats.total} 人）</div>
            </div>
          </div>

          {/* Pie */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {report.absentStudents.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
          <h3 className="text-red-300 font-semibold mb-3">缺席学生（{report.absentStudents.length} 人）</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {report.absentStudents.map((s) => (
              <div key={s.id} className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-white font-medium text-sm">{s.name}</p>
                <p className="text-slate-500 text-xs">{s.studentId}</p>
                {s.adminClass && <p className="text-slate-600 text-xs">{s.adminClass}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
