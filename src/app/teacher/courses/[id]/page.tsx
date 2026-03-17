"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import StudentImportModal from "@/components/StudentImportModal";
import ProgressImportModal from "@/components/ProgressImportModal";

interface TeachingClass {
  id: string;
  name: string;
  location: string | null;
  schedule: string | null;
  enrollments: {
    id: string;
    status: string | null;
    student: {
      id: string; name: string; studentId: string | null;
      adminClass: string | null; gender: string | null;
    };
  }[];
  sessions: { id: string; title: string; scheduledAt: string; status: string; type: string }[];
}

interface Course {
  id: string;
  name: string;
  code: string | null;
  credit: number | null;
  semester: { name: string };
  teachingClasses: TeachingClass[];
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", location: "", schedule: "" });
  const [saving, setSaving] = useState(false);
  const [importTarget, setImportTarget] = useState<string | null>(null);
  const [progressTarget, setProgressTarget] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  useEffect(() => {
    fetchCourse();
  }, [id]);

  async function fetchCourse() {
    const res = await fetch(`/api/courses/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCourse(data);
      if (data.teachingClasses.length > 0 && !activeClassId) {
        setActiveClassId(data.teachingClasses[0].id);
      }
    }
    setLoading(false);
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...classForm, courseId: id }),
    });
    if (res.ok) {
      setShowClassForm(false);
      setClassForm({ name: "", location: "", schedule: "" });
      fetchCourse();
    }
    setSaving(false);
  }

  async function handleDeleteClass(classId: string) {
    if (!confirm("确定删除该教学班？")) return;
    await fetch(`/api/classes/${classId}`, { method: "DELETE" });
    fetchCourse();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (!course) return <div className="text-red-400">课程不存在</div>;

  const activeClass = course.teachingClasses.find((c) => c.id === activeClassId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/teacher/courses" className="hover:text-white transition">课程管理</Link>
        <span>/</span>
        <span className="text-white">{course.name}</span>
      </div>

      {/* Course header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{course.name}</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {course.code && `${course.code} · `}
              {course.semester.name}
              {course.credit && ` · ${course.credit}学分`}
            </p>
          </div>
          <button
            onClick={() => setShowClassForm(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建教学班
          </button>
        </div>
      </div>

      {/* Add class form */}
      {showClassForm && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">新建教学班</h2>
          <form onSubmit={handleCreateClass} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">班级名称 *</label>
                <input type="text" value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="如：机械2505-09" required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">上课地点</label>
                <input type="text" value={classForm.location}
                  onChange={(e) => setClassForm({ ...classForm, location: e.target.value })}
                  placeholder="如：博文楼E302"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">上课时间</label>
                <input type="text" value={classForm.schedule}
                  onChange={(e) => setClassForm({ ...classForm, schedule: e.target.value })}
                  placeholder="如：周四第3-4节{1-16周}"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition">
                {saving ? "保存中..." : "保 存"}
              </button>
              <button type="button" onClick={() => setShowClassForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition">
                取 消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teaching classes tabs */}
      {course.teachingClasses.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400">暂无教学班，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {course.teachingClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition ${
                  activeClassId === cls.id
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {cls.name}
                <span className="ml-2 text-xs opacity-70">
                  {cls.enrollments.length}人
                </span>
              </button>
            ))}
          </div>

          {/* Active class detail */}
          {activeClass && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Class info */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{activeClass.name}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {activeClass.location && `📍 ${activeClass.location}`}
                    {activeClass.location && activeClass.schedule && " · "}
                    {activeClass.schedule && `🕐 ${activeClass.schedule}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportTarget(activeClass.id)}
                    className="px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/20 rounded-lg transition flex items-center gap-1.5"
                  >
                    📥 导入学生名单
                  </button>
                  <button
                    onClick={() => setProgressTarget(activeClass.id)}
                    className="px-3 py-1.5 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/20 rounded-lg transition flex items-center gap-1.5"
                  >
                    📋 导入进度表
                  </button>
                  <button
                    onClick={() => handleDeleteClass(activeClass.id)}
                    className="px-3 py-1.5 text-sm bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg transition"
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* Sessions */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">
                  课次安排（{activeClass.sessions.length} 节）
                </h4>
                {activeClass.sessions.length === 0 ? (
                  <p className="text-slate-500 text-sm">暂无课次，请导入进度表或手动添加</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {activeClass.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                          sess.status === "COMPLETED"
                            ? "bg-green-500/5 border-green-500/20"
                            : sess.status === "IN_PROGRESS"
                            ? "bg-yellow-500/5 border-yellow-500/20"
                            : "bg-slate-800/50 border-slate-700/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-white truncate font-medium">{sess.title}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {format(new Date(sess.scheduledAt), "MM/dd EEE", { locale: zhCN })}
                            <span className={`ml-2 px-1.5 rounded ${
                              sess.type === "THEORY" ? "text-blue-400" : "text-green-400"
                            }`}>
                              {sess.type === "THEORY" ? "理论" : "上机"}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                            sess.status === "COMPLETED"
                              ? "bg-green-500/20 text-green-300"
                              : sess.status === "IN_PROGRESS"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-slate-600/30 text-slate-400"
                          }`}>
                            {sess.status === "COMPLETED" ? "完成" : sess.status === "IN_PROGRESS" ? "进行中" : "待上课"}
                          </span>
                          <Link
                            href={`/teacher/sessions/${sess.id}/rollcall`}
                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded transition flex-shrink-0"
                          >
                            点名
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">
                  学生名单（{activeClass.enrollments.length} 人）
                </h4>
                {activeClass.enrollments.length === 0 ? (
                  <p className="text-slate-500 text-sm">暂无学生，请导入名单</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {activeClass.enrollments.map((en) => (
                      <div
                        key={en.id}
                        className="p-2.5 bg-slate-800/50 rounded-lg text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{en.student.name}</span>
                          {en.status === "重修" && (
                            <span className="text-orange-400 text-[10px] bg-orange-500/10 px-1 rounded">重修</span>
                          )}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {en.student.studentId}
                          {en.student.adminClass && ` · ${en.student.adminClass}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {importTarget && (
        <StudentImportModal
          classId={importTarget}
          onClose={() => setImportTarget(null)}
          onSuccess={() => { setImportTarget(null); fetchCourse(); }}
        />
      )}
      {progressTarget && (
        <ProgressImportModal
          classId={progressTarget}
          onClose={() => setProgressTarget(null)}
          onSuccess={() => { setProgressTarget(null); fetchCourse(); }}
        />
      )}
    </div>
  );
}
