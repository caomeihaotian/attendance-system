import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const classSession = await prisma.session.findUnique({
    where: { id },
    include: {
      course: { select: { name: true } },
      teachingClass: { select: { name: true } },
      attendanceRecords: {
        include: {
          student: {
            select: {
              id: true, name: true, studentId: true,
              adminClass: true, gender: true,
            },
          },
        },
      },
    },
  });

  if (!classSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = classSession.attendanceRecords.length;
  const present = classSession.attendanceRecords.filter((r) => r.status === "PRESENT").length;
  const absent = classSession.attendanceRecords.filter((r) => r.status === "ABSENT").length;
  const late = classSession.attendanceRecords.filter((r) => r.status === "LATE").length;
  const excused = classSession.attendanceRecords.filter((r) => r.status === "EXCUSED").length;

  return NextResponse.json({
    session: classSession,
    stats: { total, present, absent, late, excused, rate: total > 0 ? present / total : 0 },
    absentStudents: classSession.attendanceRecords
      .filter((r) => r.status === "ABSENT")
      .map((r) => r.student),
    lateStudents: classSession.attendanceRecords
      .filter((r) => r.status === "LATE")
      .map((r) => r.student),
  });
}
