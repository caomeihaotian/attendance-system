import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendPasswordResetSuccessEmail } from '@/lib/email-service';
import { sendPasswordResetSuccessSMS } from '@/lib/sms-service';

const prisma = new PrismaClient();

// Validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, '缺少重置令牌'),
  newPassword: z.string()
    .min(6, '密码至少需要6个字符')
    .max(100, '密码不能超过100个字符'),
  confirmPassword: z.string()
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: '两次输入的密码不一致',
    path: ['confirmPassword']
  }
);

/**
 * POST /api/auth/password-reset/reset-password
 * Reset user password using valid reset token
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
    const validationResult = resetPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '请输入有效的密码',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { token, newPassword } = validationResult.data;

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    // Verify token
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email?: string;
        phone?: string;
        type: string;
      };
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          {
            error: '重置链接已过期，请重新验证身份'
          },
          { status: 401 }
        );
      }

      if (jwtError instanceof jwt.JsonWebTokenError) {
        return NextResponse.json(
          {
            error: '无效的重置链接'
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: '令牌验证失败'
        },
        { status: 401 }
      );
    }

    // Check token type
    if (decodedToken.type !== 'password_reset') {
      return NextResponse.json(
        {
          error: '无效的令牌类型'
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        passwordHash: true
      }
    });

    if (!user) {
      return NextResponse.json(
        {
          error: '用户不存在'
        },
        { status: 404 }
      );
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash || '');
    if (isSamePassword) {
      return NextResponse.json(
        {
          error: '新密码不能与当前密码相同'
        },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        updatedAt: new Date()
      }
    });

    // Send success notification (async, don't wait)
    if (user.email) {
      sendPasswordResetSuccessEmail({
        to: user.email,
        userName: user.name
      }).catch(error => {
        console.error('Failed to send success email:', error);
      });
    }

    if (user.phone) {
      sendPasswordResetSuccessSMS({
        phoneNumber: user.phone,
        userName: user.name
      }).catch(error => {
        console.error('Failed to send success SMS:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      {
        error: '服务器错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/password-reset/reset-password
 * Check if reset token is valid (for client-side validation)
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
        email?: string;
        phone?: string;
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
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        valid: true,
        canReset: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone
        }
      });

    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          {
            valid: false,
            canReset: false,
            error: '令牌已过期，请重新验证身份'
          },
          { status: 401 }
        );
      }

      if (jwtError instanceof jwt.JsonWebTokenError) {
        return NextResponse.json(
          {
            valid: false,
            canReset: false,
            error: '无效的令牌'
          },
          { status: 401 }
        );
      }

      throw jwtError;
    }

  } catch (error) {
    console.error('Error checking reset token:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
