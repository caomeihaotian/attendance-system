import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default async function TeacherDashboard() {
  const session = await auth();
  if (!session) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [semesterCount, courseCount, totalStudents, upcomingSessions, recentSessions] =
    await Promise.all([
      prisma.semester.count({ where: { teacherId: session.user.id } }),
      prisma.course.count({ where: { teacherId: session.user.id } }),
      prisma.enrollment.count({
        where: { course: { teacherId: session.user.id } },
      }),
      prisma.session.findMany({
        where: {
          course: { teacherId: session.user.id },
          scheduledAt: { gte: todayStart, lt: weekEnd },
        },
        include: {
          course: { select: { name: true } },
          teachingClass: { select: { name: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      prisma.session.findMany({
        where: {
          course: { teacherId: session.user.id },
          status: "COMPLETED",
        },
        include: {
          course: { select: { name: true } },
          teachingClass: { select: { name: true } },
          attendanceRecords: { select: { status: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
    ]);

  const todaySessions = upcomingSessions.filter(
    (s) =>
      s.scheduledAt >= todayStart &&
      s.scheduledAt < new Date(todayStart.getTime() + 86400000)
  );

  const stats = [
    { label: "学期数", value: semesterCount, icon: "📅", color: "from-blue-600/20 to-blue-600/5 border-blue-500/20" },
    { label: "课程数", value: courseCount, icon: "📚", color: "from-purple-600/20 to-purple-600/5 border-purple-500/20" },
    { label: "学生总数", value: totalStudents, icon: "👨‍🎓", color: "from-green-600/20 to-green-600/5 border-green-500/20" },
    { label: "本周上课", value: upcomingSessions.length, icon: "🗓️", color: "from-orange-600/20 to-orange-600/5 border-orange-500/20" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          欢迎回来，{session.user.name} 老师 👋
        </h1>
        <p className="text-slate-400 mt-1">
          {format(now, "yyyy年MM月dd日 EEEE", { locale: zhCN })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-gradient-to-br ${stat.color} border rounded-xl p-5`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Today alerts */}
      {todaySessions.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <h2 className="text-red-300 font-semibold flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            今日需上课（{todaySessions.length} 节）
          </h2>
          <div className="space-y-2">
            {todaySessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-2.5">
                <div>
                  <span className="text-white font-medium">{s.course.name}</span>
                  <span className="text-slate-400 text-sm ml-2">· {s.teachingClass.name}</span>
                  <span className="text-slate-500 text-sm ml-2">· {s.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.type === "THEORY"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-green-500/20 text-green-300"
                  }`}>
                    {s.type === "THEORY" ? "理论课" : "上机课"}
                  </span>
                  <Link
                    href={`/teacher/sessions/${s.id}/rollcall`}
                    className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
                  >
                    开始点名
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This week */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center justify-between">
            本周课程安排
            <Link href="/teacher/courses" className="text-xs text-purple-400 hover:text-purple-300">
              查看全部 →
            </Link>
          </h2>
          {upcomingSessions.length === 0 ? (
            <p className="text-slate-500 text-sm">本周暂无课程安排</p>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((s) => {
                const isToday =
                  s.scheduledAt >= todayStart &&
                  s.scheduledAt < new Date(todayStart.getTime() + 86400000);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isToday
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-slate-800/50 border-slate-700/30"
                    }`}
                  >
                    <div className="text-center min-w-[40px]">
                      <div className="text-xs text-slate-500">
                        {format(s.scheduledAt, "MM/dd")}
                      </div>
                      <div className="text-xs text-slate-400">
                        {format(s.scheduledAt, "EEE", { locale: zhCN })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.course.name}</p>
                      <p className="text-xs text-slate-500">{s.teachingClass.name} · {s.title}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      s.status === "COMPLETED"
                        ? "bg-green-500/20 text-green-300"
                        : s.status === "IN_PROGRESS"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-slate-600/30 text-slate-400"
                    }`}>
                      {s.status === "COMPLETED" ? "已完成" : s.status === "IN_PROGRESS" ? "进行中" : "待上课"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center justify-between">
            最近点名记录
            <Link href="/teacher/reports" className="text-xs text-purple-400 hover:text-purple-300">
              查看报表 →
            </Link>
          </h2>
          {recentSessions.length === 0 ? (
            <p className="text-slate-500 text-sm">暂无点名记录</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => {
                const total = s.attendanceRecords.length;
                const present = s.attendanceRecords.filter((r) => r.status === "PRESENT").length;
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.course.name}</p>
                      <p className="text-xs text-slate-500">
                        {format(s.scheduledAt, "MM/dd")} · {s.teachingClass.name} · {s.title}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-medium ${rate >= 90 ? "text-green-400" : rate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                        {rate}%
                      </div>
                      <div className="text-xs text-slate-500">{present}/{total}</div>
                    </div>
                    <Link
                      href={`/teacher/reports/session/${s.id}`}
                      className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
                    >
                      详情
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/teacher/semesters", label: "新建学期", icon: "➕", desc: "创建新的学期" },
          { href: "/teacher/courses", label: "管理课程", icon: "📚", desc: "查看和管理课程" },
          { href: "/teacher/reports", label: "出勤报表", icon: "📊", desc: "查看出勤统计" },
          { href: "/teacher/courses", label: "导入名单", icon: "📥", desc: "批量导入学生" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-800/50 hover:border-slate-700 transition group"
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <div className="font-medium text-white text-sm group-hover:text-purple-300 transition">{action.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
