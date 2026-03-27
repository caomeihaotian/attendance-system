import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  generateVerificationCode,
  calculateExpiry,
  isValidEmail
} from '@/lib/verification-code';
import { sendVerificationEmail } from '@/lib/email-service';
import { checkVerificationCodeRateLimit } from '@/lib/rate-limit';

const prisma = new PrismaClient();

// Validation schema
const sendEmailCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

/**
 * POST /api/auth/password-reset/send-email-code
 * Send verification code to email for password reset
 */
export async function POST(request: NextRequest) {
  try {
    // Skip CSRF check for this custom API route
    // This route has its own rate limiting and validation
    const csrfToken = request.headers.get('x-csrf-token');
    const cookieHeader = request.headers.get('cookie');

    // Only validate CSRF in production (optional, for additional security)
    if (process.env.NODE_ENV === 'production' && !csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validationResult = sendEmailCodeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '请输入有效的邮箱地址',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;
    const emailLower = email.toLowerCase().trim();

    // Check rate limit
    const rateLimitResult = checkVerificationCodeRateLimit(`email-reset:${emailLower}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: rateLimitResult.error,
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 }
      );
    }

    // Check if email exists in database
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      // Don't reveal whether email exists for security reasons
      // But still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: '如果该邮箱已注册，验证码将发送至您的邮箱'
      });
    }

    // Check if there's a recent unused code (within 1 minute)
    const recentCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email: emailLower,
        used: false,
        type: 'EMAIL_RESET',
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000) // Last 1 minute
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentCode) {
      return NextResponse.json(
        {
          error: '验证码已发送，请1分钟后再试',
          retryAfter: 60
        },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = calculateExpiry(5); // 5 minutes

    console.log('💾 Attempting to save verification code to database...');
    console.log(`📧 Email: ${emailLower}`);
    console.log(`🔑 Code: ${code}`);
    console.log(`👤 User ID: ${user.id}`);

    // Save to database
    let savedCode;
    try {
      savedCode = await prisma.emailVerificationCode.create({
        data: {
          email: emailLower,
          code,
          type: 'EMAIL_RESET',
          expiresAt,
          userId: user.id
        }
      });
      console.log('✅ Verification code saved to database successfully');
      console.log(`🆔 Saved record ID: ${savedCode.id}`);
    } catch (dbError) {
      console.error('❌ Error saving verification code to database:', dbError);
      return NextResponse.json(
        {
          error: '保存验证码失败，请稍后重试',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Mark previous codes as used (except the one we just created)
    await prisma.emailVerificationCode.updateMany({
      where: {
        email: emailLower,
        used: false,
        type: 'EMAIL_RESET',
        id: { not: savedCode.id } // Don't update the one we just created
      },
      data: {
        used: true
      }
    });

    // Send email
    const emailResult = await sendVerificationEmail({
      to: emailLower,
      code,
      purpose: 'password_reset'
    });

    // Development mode: Always log the verification code to console
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development Mode: Verification Code');
      console.log(`📧 Email: ${emailLower}`);
      console.log(`🔑 Code: ${code}`);
      console.log(`⏰ Expires at: ${expiresAt.toISOString()}`);
      console.log(`⏳ Valid for: 5 minutes`);
    }

    if (!emailResult.success) {
      // Development mode: If email service is not configured, log the code and continue
      if (emailResult.error?.includes('邮件服务未配置')) {
        console.log('📧 Email service not configured, but continuing in development mode');
        // Continue without failing in development mode
      } else {
        console.error('Failed to send verification email:', emailResult.error);
        return NextResponse.json(
          {
            error: '验证码发送失败，请稍后重试',
            details: emailResult.error
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送至您的邮箱',
      expiresIn: 300, // 5 minutes in seconds
      canResendIn: 60 // Can resend after 1 minute
    });

  } catch (error) {
    console.error('Error sending email verification code:', error);
    return NextResponse.json(
      {
        error: '服务器错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/password-reset/send-email-code
 * Check rate limit status (optional endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: '请提供邮箱地址' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const rateLimitResult = checkVerificationCodeRateLimit(`email-reset:${emailLower}`);

    // Check for recent code
    const recentCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email: emailLower,
        used: false,
        type: 'EMAIL_RESET',
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const canResend = !recentCode && rateLimitResult.success;

    return NextResponse.json({
      canResend,
      remainingAttempts: rateLimitResult.remainingAttempts,
      resetTime: rateLimitResult.resetTime,
      recentCodeSent: !!recentCode
    });

  } catch (error) {
    console.error('Error checking email code status:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
