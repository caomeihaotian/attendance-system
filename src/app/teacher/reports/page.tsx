"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Course {
  id: string;
  name: string;
  semester: { name: string };
}

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

interface StudentStat {
  student: { id: string; name: string; studentId: string | null };
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

interface CourseReport {
  course: { id: string; name: string };
  totalSessions: number;
  studentStats: StudentStat[];
}

const COLORS = ["#22c55e", "#ef4444", "#eab308", "#3b82f6"];

function ReportsContent() {
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get("courseId");

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId ?? "");
  const [courseReport, setCourseReport] = useState<CourseReport | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; scheduledAt: string; status: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourses);
  }, []);

  useEffect(() => {
    if (initialCourseId) {
      handleSelectCourse(initialCourseId);
    }
  }, [initialCourseId]);

  async function handleSelectCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setLoading(true);
    const [reportRes, sessRes] = await Promise.all([
      fetch(`/api/reports/course/${courseId}`),
      fetch(`/api/sessions?courseId=${courseId}`),
    ]);
    if (reportRes.ok) setCourseReport(await reportRes.json());
    if (sessRes.ok) {
      const data = await sessRes.json();
      setSessions(data.filter((s: { status: string }) => s.status === "COMPLETED"));
    }
    setLoading(false);
  }

  async function handleSelectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    const res = await fetch(`/api/reports/session/${sessionId}`);
    if (res.ok) setSessionReport(await res.json());
  }

  async function handleExportSession() {
    if (!sessionReport) return;
    const { default: XLSX } = await import("xlsx");
    const rows = sessionReport.session.course
      ? sessionReport.absentStudents.map((s) => ({
          姓名: s.name,
          学号: s.studentId,
          班级: s.adminClass,
          状态: "缺席",
        }))
      : [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "缺席名单");
    XLSX.writeFile(wb, `缺席名单_${sessionReport.session.title}.xlsx`);
  }

  const pieData = sessionReport
    ? [
        { name: "出勤", value: sessionReport.stats.present },
        { name: "缺席", value: sessionReport.stats.absent },
        { name: "迟到", value: sessionReport.stats.late },
        { name: "请假", value: sessionReport.stats.excused },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">出勤报表</h1>
        <p className="text-slate-400 text-sm mt-1">查看课程和单课出勤统计</p>
      </div>

      {/* Course selector */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-3">选择课程</h2>
        <div className="flex gap-2 flex-wrap">
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectCourse(c.id)}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                selectedCourseId === c.id
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {c.name}
              <span className="ml-1.5 text-xs opacity-60">{c.semester.name}</span>
            </button>
          ))}
          {courses.length === 0 && (
            <p className="text-slate-500 text-sm">暂无课程</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400" />
        </div>
      )}

      {courseReport && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session selector */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-3">
              已完成课次（{sessions.length}）
            </h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-slate-500 text-sm">暂无已完成课次</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedSessionId === s.id
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/20"
                        : "bg-slate-800/50 text-slate-400 hover:text-white"
                    }`}
                  >
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="text-xs opacity-60">
                      {format(new Date(s.scheduledAt), "MM/dd EEE", { locale: zhCN })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Session report */}
          <div className="lg:col-span-2 space-y-4">
            {sessionReport ? (
              <>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">{sessionReport.session.title}</h3>
                      <p className="text-slate-400 text-sm mt-0.5">
                        {format(new Date(sessionReport.session.scheduledAt), "yyyy年MM月dd日 EEE", { locale: zhCN })} ·
                        {sessionReport.session.teachingClass.name}
                      </p>
                    </div>
                    <button
                      onClick={handleExportSession}
                      className="px-3 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/20 rounded-lg transition"
                    >
                      📤 导出缺席名单
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Stats */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "出勤", value: sessionReport.stats.present, color: "text-green-400" },
                          { label: "缺席", value: sessionReport.stats.absent, color: "text-red-400" },
                          { label: "迟到", value: sessionReport.stats.late, color: "text-yellow-400" },
                          { label: "请假", value: sessionReport.stats.excused, color: "text-blue-400" },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <div className={`text-3xl font-bold ${
                          sessionReport.stats.rate >= 0.9 ? "text-green-400" :
                          sessionReport.stats.rate >= 0.7 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {Math.round(sessionReport.stats.rate * 100)}%
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">出勤率（共{sessionReport.stats.total}人）</div>
                      </div>
                    </div>

                    {/* Pie chart */}
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65}
                            dataKey="value">
                            {pieData.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Absent list */}
                {sessionReport.absentStudents.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                    <h4 className="text-red-300 font-medium mb-3 text-sm">
                      缺席学生（{sessionReport.absentStudents.length} 人）
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sessionReport.absentStudents.map((s) => (
                        <div key={s.id} className="bg-slate-800/50 rounded-lg p-2 text-xs">
                          <p className="text-white font-medium">{s.name}</p>
                          <p className="text-slate-500">{s.studentId} {s.adminClass && `· ${s.adminClass}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Late list */}
                {sessionReport.lateStudents.length > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                    <h4 className="text-yellow-300 font-medium mb-2 text-sm">
                      迟到学生（{sessionReport.lateStudents.length} 人）
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {sessionReport.lateStudents.map((s) => (
                        <span key={s.id} className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center">
                <p className="text-slate-500">← 选择左侧课次查看详情</p>
              </div>
            )}

            {/* Course-level student stats */}
            {courseReport.studentStats.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 text-sm">
                  全课程学生出勤汇总（共 {courseReport.totalSessions} 节课）
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {["学生", "学号", "出勤", "缺席", "迟到", "请假", "出勤率"].map((h) => (
                          <th key={h} className="text-left py-2 pr-3 text-slate-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {courseReport.studentStats.map((stat) => {
                        const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
                        return (
                          <tr key={stat.student.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 pr-3 text-white font-medium">{stat.student.name}</td>
                            <td className="py-2 pr-3 text-slate-400">{stat.student.studentId}</td>
                            <td className="py-2 pr-3 text-green-400">{stat.present}</td>
                            <td className="py-2 pr-3 text-red-400">{stat.absent}</td>
                            <td className="py-2 pr-3 text-yellow-400">{stat.late}</td>
                            <td className="py-2 pr-3 text-blue-400">{stat.excused}</td>
                            <td className={`py-2 font-bold ${rate >= 90 ? "text-green-400" : rate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                              {rate}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  );
}
