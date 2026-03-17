import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface StudentRow {
  studentId: string;
  name: string;
  gender?: string;
  major?: string;
  adminClass?: string;
  remark?: string;
}

const BATCH_SIZE = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const teachingClass = await prisma.teachingClass.findFirst({
    where: { id, course: { teacherId: session.user.id } },
    include: { course: true },
  });
  if (!teachingClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const body = await req.json();
  const students: StudentRow[] = body.students;

  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: "No students provided" }, { status: 400 });
  }

  const validStudents = students.filter((s) => s.studentId && s.name);
  const errors: string[] = [];
  const skipped = students.length - validStudents.length;
  if (skipped > 0) {
    errors.push(`跳过 ${skipped} 条学号或姓名为空的记录`);
  }

  // Batch-fetch all existing users in ONE query instead of 150 individual queries
  const existingUsers = await prisma.user.findMany({
    where: { studentId: { in: validStudents.map((s) => s.studentId) } },
  });
  const existingUserMap = new Map(
    existingUsers.map((u) => [u.studentId!, u])
  );

  // Pre-compute bcrypt hashes ONLY for new students (skip for existing ones)
  const hashMap = new Map<string, string>();
  for (const s of validStudents) {
    if (!existingUserMap.has(s.studentId)) {
      hashMap.set(
        s.studentId,
        await bcrypt.hash(s.studentId.slice(-6), 10)
      );
    }
  }

  let created = 0;
  let updated = 0;
  let retakes = 0;

  // Process in batches with transactions to avoid connection drops
  for (let i = 0; i < validStudents.length; i += BATCH_SIZE) {
    const batch = validStudents.slice(i, i + BATCH_SIZE);

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          let bCreated = 0;
          let bUpdated = 0;
          let bRetakes = 0;

          for (const row of batch) {
            const isRetake = row.remark?.includes("重修") ?? false;
            const existing = existingUserMap.get(row.studentId);
            let userId: string;

            if (existing) {
              await tx.user.update({
                where: { studentId: row.studentId },
                data: {
                  name: row.name,
                  gender: row.gender,
                  major: row.major,
                  adminClass: row.adminClass,
                  remark: row.remark,
                },
              });
              userId = existing.id;
              bUpdated++;
            } else {
              const newUser = await tx.user.create({
                data: {
                  studentId: row.studentId,
                  name: row.name,
                  role: "STUDENT",
                  passwordHash: hashMap.get(row.studentId)!,
                  gender: row.gender,
                  major: row.major,
                  adminClass: row.adminClass,
                  remark: row.remark,
                },
              });
              userId = newUser.id;
              existingUserMap.set(row.studentId, { ...newUser, studentId: row.studentId });
              bCreated++;
            }

            if (isRetake) bRetakes++;

            await tx.enrollment.upsert({
              where: {
                studentId_teachingClassId: {
                  studentId: userId,
                  teachingClassId: id,
                },
              },
              create: {
                studentId: userId,
                courseId: teachingClass.courseId,
                teachingClassId: id,
                status: isRetake ? "重修" : "正常",
              },
              update: {
                status: isRetake ? "重修" : "正常",
              },
            });
          }

          return { created: bCreated, updated: bUpdated, retakes: bRetakes };
        },
        { timeout: 60000 }
      );

      created += result.created;
      updated += result.updated;
      retakes += result.retakes;
    } catch (err) {
      const start = i + 1;
      const end = Math.min(i + BATCH_SIZE, validStudents.length);
      errors.push(`第 ${start}-${end} 条记录导入失败: ${String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    retakes,
    total: students.length,
    errors: errors.slice(0, 20),
  });
}
