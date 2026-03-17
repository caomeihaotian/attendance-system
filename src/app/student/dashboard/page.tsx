import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";

const statusConfig = {
  PRESENT: { label: "出勤", color: "text-green-300", bg: "bg-green-500/10 border-green-500/20" },
  ABSENT: { label: "缺席", color: "text-red-300", bg: "bg-red-500/10 border-red-500/20" },
  LATE: { label: "迟到", color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/20" },
  EXCUSED: { label: "请假", color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20" },
};

export default async function StudentDashboard() {
  const session = await auth();
  if (!session) return null;

  const userId = session.user.id;

  const [enrollments, recentRecords] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: userId },
      include: {
        course: {
          include: {
            semester: { select: { name: true } },
          },
        },
        teachingClass: {
          include: {
            sessions: {
              where: { status: "COMPLETED" },
              include: {
                attendanceRecords: {
                  where: { studentId: userId },
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: userId },
      include: {
        session: {
          include: {
            course: { select: { name: true } },
            teachingClass: { select: { name: true } },
          },
        },
      },
      orderBy: { checkedAt: "desc" },
      take: 20,
    }),
  ]);

  const totalSessions = recentRecords.length;
  const presentCount = recentRecords.filter((r) => r.status === "PRESENT").length;
  const absentCount = recentRecords.filter((r) => r.status === "ABSENT").length;
  const overallRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          你好，{session.user.name} 同学 👋
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 border border-green-500/20 rounded-xl p-5 text-center">
          <div className={`text-3xl font-bold ${overallRate >= 90 ? "text-green-400" : overallRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {overallRate}%
          </div>
          <div className="text-sm text-slate-400 mt-1">总出勤率</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-500/20 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-purple-400">{totalSessions}</div>
          <div className="text-sm text-slate-400 mt-1">已上课次</div>
        </div>
        <div className="bg-gradient-to-br from-red-600/20 to-red-600/5 border border-red-500/20 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-red-400">{absentCount}</div>
          <div className="text-sm text-slate-400 mt-1">缺勤次数</div>
        </div>
      </div>

      {/* My courses */}
      <div>
        <h2 className="font-semibold text-white mb-3">我的课程</h2>
        {enrollments.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/30 border border-slate-800 rounded-xl">
            <p className="text-slate-500">暂未选课</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map((en) => {
              const completedSessions = en.teachingClass.sessions;
              const myRecords = completedSessions.flatMap((s) => s.attendanceRecords);
              const myPresent = myRecords.filter((r) => r.status === "PRESENT").length;
              const myRate = myRecords.length > 0 ? Math.round((myPresent / myRecords.length) * 100) : null;

              return (
                <div
                  key={en.id}
                  className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{en.course.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {en.course.semester.name} · {en.teachingClass.name}
                      </p>
                    </div>
                    {en.status === "重修" && (
                      <span className="text-orange-300 text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">重修</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-slate-400">
                      已上 {completedSessions.length} 节课
                    </div>
                    {myRate !== null && (
                      <div className={`text-sm font-bold ${myRate >= 90 ? "text-green-400" : myRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                        出勤率 {myRate}%
                      </div>
                    )}
                  </div>
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        (myRate ?? 0) >= 90 ? "bg-green-500" : (myRate ?? 0) >= 70 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${myRate ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent attendance */}
      <div>
        <h2 className="font-semibold text-white mb-3">最近出勤记录</h2>
        {recentRecords.length === 0 ? (
          <div className="text-center py-8 bg-slate-900/30 border border-slate-800 rounded-xl">
            <p className="text-slate-500 text-sm">暂无出勤记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRecords.map((record) => {
              const cfg = statusConfig[record.status as keyof typeof statusConfig] ?? statusConfig.ABSENT;
              return (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${cfg.bg}`}
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {record.session.course.name}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {record.session.teachingClass.name} ·{" "}
                      {format(new Date(record.session.scheduledAt), "MM月dd日 EEE", { locale: zhCN })}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
