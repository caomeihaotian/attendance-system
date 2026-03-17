"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const RollCallScene = dynamic(() => import("@/components/three/RollCallScene"), { ssr: false });

interface Student {
  id: string;
  name: string;
  studentId: string | null;
  adminClass?: string | null;
  gender?: string | null;
}

interface AttendanceRecord {
  studentId: string;
  status: string;
}

interface SessionData {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  type: string;
  course: { name: string };
  teachingClass: {
    name: string;
    enrollments: { student: Student }[];
  };
  attendanceRecords: AttendanceRecord[];
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  PRESENT: { label: "出勤", color: "text-green-300", bg: "bg-green-500/20 border-green-500/30" },
  ABSENT: { label: "缺席", color: "text-red-300", bg: "bg-red-500/20 border-red-500/30" },
  LATE: { label: "迟到", color: "text-yellow-300", bg: "bg-yellow-500/20 border-yellow-500/30" },
  EXCUSED: { label: "请假", color: "text-blue-300", bg: "bg-blue-500/20 border-blue-500/30" },
};

export default function RollCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const [randomPicked, setRandomPicked] = useState<Student[]>([]);

  useEffect(() => {
    fetchSession();
  }, [id]);

  async function fetchSession() {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data);

      // Initialize attendance from existing records
      const init: Record<string, AttendanceStatus> = {};
      data.teachingClass.enrollments.forEach((en: { student: Student }) => {
        init[en.student.id] = "ABSENT";
      });
      data.attendanceRecords.forEach((r: AttendanceRecord) => {
        init[r.studentId] = r.status as AttendanceStatus;
      });
      setAttendance(init);
      setStarted(data.status !== "PENDING");
    }
    setLoading(false);
  }

  async function handleStart() {
    await fetch(`/api/sessions/${id}/start`, { method: "POST" });
    setStarted(true);
    setSession((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
  }

  function handleStatusChange(studentId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  function handleMarkAll(status: AttendanceStatus) {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendance(updated);
  }

  async function handleSave() {
    setSaving(true);
    const records = Object.entries(attendance).map(([studentId, status]) => ({
      sessionId: id,
      studentId,
      status,
    }));

    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    setSaving(false);
  }

  async function handleEnd() {
    await handleSave();
    await fetch(`/api/sessions/${id}/end`, { method: "POST" });
    setSession((prev) => prev ? { ...prev, status: "COMPLETED" } : prev);
  }

  function handleRandomSelect(student: Student) {
    setRandomPicked((prev) => [...prev, student]);
    // Mark as present when picked
    setAttendance((prev) => ({ ...prev, [student.id]: "PRESENT" }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (!session) return <div className="text-red-400 p-8">课次不存在</div>;

  const students = session.teachingClass.enrollments.map((e) => e.student);
  const presentCount = Object.values(attendance).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(attendance).filter((s) => s === "ABSENT").length;
  const lateCount = Object.values(attendance).filter((s) => s === "LATE").length;
  const excusedCount = Object.values(attendance).filter((s) => s === "EXCUSED").length;

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/teacher/dashboard"
            className="text-slate-400 hover:text-white transition"
          >
            ← 返回
          </Link>
          <div>
            <h1 className="text-white font-semibold">{session.course.name}</h1>
            <p className="text-slate-400 text-xs">
              {session.teachingClass.name} ·{" "}
              {format(new Date(session.scheduledAt), "MM月dd日 EEE", { locale: zhCN })} ·{" "}
              {session.title}
              <span className={`ml-2 px-1.5 rounded text-[10px] ${
                session.type === "THEORY" ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"
              }`}>
                {session.type === "THEORY" ? "理论课" : "上机课"}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <span className="text-green-400">出勤 <strong>{presentCount}</strong></span>
            <span className="text-red-400">缺席 <strong>{absentCount}</strong></span>
            <span className="text-yellow-400">迟到 <strong>{lateCount}</strong></span>
            <span className="text-blue-400">请假 <strong>{excusedCount}</strong></span>
          </div>
          <div className="flex gap-2">
            {/* Mode switch */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setMode("random")}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  mode === "random" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                🎲 随机点名
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  mode === "manual" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                📋 手动签到
              </button>
            </div>

            {!started ? (
              <button
                onClick={handleStart}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition"
              >
                开始上课
              </button>
            ) : session.status !== "COMPLETED" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={handleEnd}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition"
                >
                  结束课堂
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-green-400 text-sm">✅ 已完成</span>
                <Link
                  href={`/teacher/reports/session/${id}`}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition"
                >
                  查看报表
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden">
        {mode === "random" ? (
          <div className="h-full">
            {!started ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎲</div>
                  <h2 className="text-white text-2xl font-bold mb-2">随机点名模式</h2>
                  <p className="text-slate-400 mb-6">点击"开始上课"后可开始随机抽取学生</p>
                  <button onClick={handleStart}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition">
                    开始上课
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex">
                {/* Three.js canvas */}
                <div className="flex-1">
                  <RollCallScene
                    students={students.filter((s) => !randomPicked.find((p) => p.id === s.id))}
                    onSelect={handleRandomSelect}
                  />
                </div>
                {/* Side panel - picked students */}
                {randomPicked.length > 0 && (
                  <div className="w-56 bg-slate-900/80 border-l border-slate-800 p-4 overflow-y-auto">
                    <p className="text-slate-400 text-xs mb-3">已抽到 ({randomPicked.length})</p>
                    <div className="space-y-2">
                      {randomPicked.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                          <div>
                            <p className="text-white text-sm font-medium">{s.name}</p>
                            <p className="text-slate-500 text-xs">{s.studentId}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleStatusChange(s.id, st)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                  attendance[s.id] === st
                                    ? statusConfig[st].bg + " " + statusConfig[st].color
                                    : "bg-slate-700/30 border-slate-700 text-slate-500"
                                }`}
                              >
                                {statusConfig[st].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Manual mode */
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Batch actions */}
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">共 {students.length} 名学生</p>
                <div className="flex gap-2">
                  <button onClick={() => handleMarkAll("PRESENT")}
                    className="px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/20 rounded-lg transition">
                    全部出勤
                  </button>
                  <button onClick={() => handleMarkAll("ABSENT")}
                    className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/20 rounded-lg transition">
                    全部缺席
                  </button>
                </div>
              </div>

              {/* Student cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {students.map((student) => {
                  const status = attendance[student.id] ?? "ABSENT";
                  const cfg = statusConfig[status];
                  return (
                    <div
                      key={student.id}
                      className={`relative p-3 rounded-xl border cursor-pointer transition select-none ${cfg.bg}`}
                    >
                      <div className="text-center mb-2">
                        <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-lg font-bold ${cfg.color} bg-current/10`}
                          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          {student.name.charAt(0)}
                        </div>
                        <p className={`text-sm font-medium mt-1 ${cfg.color}`}>{student.name}</p>
                        <p className="text-slate-500 text-xs">{student.studentId}</p>
                        {student.adminClass && (
                          <p className="text-slate-600 text-[10px]">{student.adminClass}</p>
                        )}
                      </div>
                      {/* Status buttons */}
                      <div className="grid grid-cols-2 gap-1">
                        {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(student.id, st)}
                            className={`text-[10px] py-0.5 rounded border transition ${
                              status === st
                                ? statusConfig[st].bg + " " + statusConfig[st].color + " font-bold"
                                : "bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {statusConfig[st].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save button at bottom */}
              {started && session.status !== "COMPLETED" && (
                <div className="flex justify-center gap-3 pt-4">
                  <button onClick={handleSave} disabled={saving}
                    className="px-8 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-xl transition">
                    {saving ? "保存中..." : "保存签到"}
                  </button>
                  <button onClick={handleEnd}
                    className="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition">
                    结束课堂
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
