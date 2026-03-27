import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码").optional(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  // Skip CSRF check for this custom API route
  // This route has its own validation
  const csrfToken = req.headers.get('x-csrf-token');

  // Only validate CSRF in production (optional, for additional security)
  if (process.env.NODE_ENV === 'production' && !csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token missing' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "邮箱已被注册" }, { status: 409 });
  }

  // Check if phone number already exists (if provided)
  if (parsed.data.phone) {
    const existingPhone = await prisma.user.findFirst({ where: { phone: parsed.data.phone } });
    if (existingPhone) {
      return NextResponse.json({ error: "手机号已被注册" }, { status: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      role: "TEACHER",
    },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
