import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { isCodeExpired } from '@/lib/verification-code';

const prisma = new PrismaClient();

// Validation schema
const verifyEmailCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().regex(/^\d{6}$/, '验证码必须是6位数字'),
});

/**
 * POST /api/auth/password-reset/verify-email-code
 * Verify email verification code and issue temporary token
 */
export async function POST(request: NextRequest) {
  try {
    // Skip CSRF check for this custom API route
    // This route has its own rate limiting and validation
    const csrfToken = request.headers.get('x-csrf-token');

    // Only validate CSRF in production (optional, for additional security)
    if (process.env.NODE_ENV === 'production' && !csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validationResult = verifyEmailCodeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '请输入有效的邮箱和验证码',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { email, code } = validationResult.data;
    const emailLower = email.toLowerCase().trim();

    // Find the verification code
    const verificationCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email: emailLower,
        code,
        type: 'EMAIL_RESET',
        used: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!verificationCode) {
      return NextResponse.json(
        {
          error: '验证码错误或不存在'
        },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (isCodeExpired(verificationCode.expiresAt)) {
      return NextResponse.json(
        {
          error: '验证码已过期，请重新获取'
        },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        {
          error: '用户不存在'
        },
        { status: 404 }
      );
    }

    // Mark code as used
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true }
    });

    // Generate temporary token for password reset (15 minutes validity)
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: 'password_reset'
      },
      JWT_SECRET,
      {
        expiresIn: '15m'
      }
    );

    return NextResponse.json({
      success: true,
      message: '验证成功',
      resetToken,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Error verifying email code:', error);
    return NextResponse.json(
      {
        error: '服务器错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/password-reset/verify-email-code
 * Check if a token is still valid
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: '未提供令牌' },
        { status: 400 }
      );
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        type: string;
      };

      if (decoded.type !== 'password_reset') {
        return NextResponse.json(
          { error: '无效的令牌类型' },
          { status: 400 }
        );
      }

      // Check if user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true }
      });

      if (!user) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email
        }
      });

    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          {
            valid: false,
            error: '令牌已过期，请重新验证'
          },
          { status: 401 }
        );
      }

      if (jwtError instanceof jwt.JsonWebTokenError) {
        return NextResponse.json(
          {
            valid: false,
            error: '无效的令牌'
          },
          { status: 401 }
        );
      }

      throw jwtError;
    }

  } catch (error) {
    console.error('Error checking token validity:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
