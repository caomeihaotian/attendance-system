"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Semester {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  code: string | null;
  credit: number | null;
  nature: string | null;
  semester: { id: string; name: string };
  teachingClasses: { id: string; name: string; enrollments: { id: string }[] }[];
}

export default function CoursesPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", semesterId: "", code: "", credit: "", nature: "必修课" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/semesters").then((r) => r.json()).then(setSemesters);
    fetchCourses();
  }, []);

  async function fetchCourses(semesterId?: string) {
    setLoading(true);
    const url = semesterId && semesterId !== "all"
      ? `/api/courses?semesterId=${semesterId}`
      : "/api/courses";
    const res = await fetch(url);
    if (res.ok) setCourses(await res.json());
    setLoading(false);
  }

  function handleSemesterFilter(sid: string) {
    setSelectedSemester(sid);
    fetchCourses(sid);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.semesterId) return alert("请选择学期");
    setSaving(true);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        credit: form.credit ? parseFloat(form.credit) : undefined,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", semesterId: "", code: "", credit: "", nature: "必修课" });
      fetchCourses(selectedSemester);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该课程？所有关联数据将一并删除。")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    fetchCourses(selectedSemester);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">课程管理</h1>
          <p className="text-slate-400 text-sm mt-1">管理您的课程和教学班</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建课程
        </button>
      </div>

      {/* Semester filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleSemesterFilter("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition ${
            selectedSemester === "all"
              ? "bg-purple-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          全部学期
        </button>
        {semesters.map((sem) => (
          <button
            key={sem.id}
            onClick={() => handleSemesterFilter(sem.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition ${
              selectedSemester === sem.id
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {sem.name}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">新建课程</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">课程名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：C语言程序设计"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">所属学期 *</label>
                <select
                  value={form.semesterId}
                  onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">请选择学期</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>{sem.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">课程代码</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="如：B0421103"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">学分</label>
                <input
                  type="number"
                  value={form.credit}
                  onChange={(e) => setForm({ ...form, credit: e.target.value })}
                  placeholder="如：2.0"
                  step="0.5"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">课程性质</label>
                <select
                  value={form.nature}
                  onChange={(e) => setForm({ ...form, nature: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option>必修课</option>
                  <option>选修课</option>
                  <option>实验课</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition">
                {saving ? "保存中..." : "保 存"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition">
                取 消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Course list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-slate-400">暂无课程，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => {
            const totalStudents = course.teachingClasses.reduce(
              (acc, c) => acc + c.enrollments.length, 0
            );
            return (
              <div
                key={course.id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{course.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {course.code && `${course.code} · `}
                      {course.semester.name}
                      {course.credit && ` · ${course.credit}学分`}
                    </p>
                  </div>
                  {course.nature && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {course.nature}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400 mb-4">
                  <span>{course.teachingClasses.length} 个教学班</span>
                  <span>·</span>
                  <span>{totalStudents} 名学生</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/teacher/courses/${course.id}`}
                    className="flex-1 text-center py-1.5 text-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 rounded-lg transition"
                  >
                    管理班级
                  </Link>
                  <Link
                    href={`/teacher/reports?courseId=${course.id}`}
                    className="flex-1 text-center py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    查看报表
                  </Link>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
