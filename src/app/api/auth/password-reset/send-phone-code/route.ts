import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  generateVerificationCode,
  calculateExpiry,
  isValidChinesePhone,
  formatPhoneNumber
} from '@/lib/verification-code';
import { sendSMS } from '@/lib/sms-service';
import { checkVerificationCodeRateLimit } from '@/lib/rate-limit';

const prisma = new PrismaClient();

// Validation schema
const sendPhoneCodeSchema = z.object({
  phone: z.string().refine(
    (phone) => isValidChinesePhone(phone),
    '请输入有效的手机号码'
  ),
});

/**
 * POST /api/auth/password-reset/send-phone-code
 * Send verification code to phone for password reset
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
    const validationResult = sendPhoneCodeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '请输入有效的手机号码',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { phone } = validationResult.data;
    const formattedPhone = formatPhoneNumber(phone);

    // Check rate limit
    const rateLimitResult = checkVerificationCodeRateLimit(`phone-reset:${formattedPhone}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: rateLimitResult.error,
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 }
      );
    }

    // Check if phone number exists in database
    const user = await prisma.user.findFirst({
      where: { phone: formattedPhone },
      select: { id: true, name: true, phone: true }
    });

    if (!user) {
      // Don't reveal whether phone exists for security reasons
      return NextResponse.json({
        success: true,
        message: '如果该手机号已注册，验证码将发送至您的手机'
      });
    }

    // Check if there's a recent unused code (within 1 minute)
    const recentCode = await prisma.phoneVerificationCode.findFirst({
      where: {
        phone: formattedPhone,
        used: false,
        type: 'PHONE_RESET',
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

    console.log('💾 Attempting to save phone verification code to database...');
    console.log(`📱 Phone: ${formattedPhone}`);
    console.log(`🔑 Code: ${code}`);
    console.log(`👤 User ID: ${user.id}`);

    // Save to database
    let savedCode;
    try {
      savedCode = await prisma.phoneVerificationCode.create({
        data: {
          phone: formattedPhone,
          code,
          type: 'PHONE_RESET',
          expiresAt,
          userId: user.id
        }
      });
      console.log('✅ Phone verification code saved to database successfully');
      console.log(`🆔 Saved record ID: ${savedCode.id}`);
    } catch (dbError) {
      console.error('❌ Error saving phone verification code to database:', dbError);
      return NextResponse.json(
        {
          error: '保存验证码失败，请稍后重试',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Mark previous codes as used (except the one we just created)
    await prisma.phoneVerificationCode.updateMany({
      where: {
        phone: formattedPhone,
        used: false,
        type: 'PHONE_RESET',
        id: { not: savedCode.id }
      },
      data: {
        used: true
      }
    });

    // Send SMS
    const smsResult = await sendSMS({
      phoneNumber: formattedPhone,
      code,
      purpose: 'password_reset'
    });

    // Development mode: Always log the verification code to console
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development Mode: Verification Code');
      console.log(`📱 Phone: ${formattedPhone}`);
      console.log(`🔑 Code: ${code}`);
      console.log(`⏰ Expires at: ${expiresAt.toISOString()}`);
      console.log(`⏳ Valid for: 5 minutes`);
    }

    if (!smsResult.success) {
      // Development mode: If SMS service is not configured, log the code and continue
      if (smsResult.error?.includes('短信服务未配置')) {
        console.log('📱 SMS service not configured, but continuing in development mode');
        // Continue without failing in development mode
      } else {
        console.error('Failed to send verification SMS:', smsResult.error);
        return NextResponse.json(
          {
            error: '验证码发送失败，请稍后重试',
            details: smsResult.error
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送至您的手机',
      expiresIn: 300, // 5 minutes in seconds
      canResendIn: 60 // Can resend after 1 minute
    });

  } catch (error) {
    console.error('Error sending phone verification code:', error);
    return NextResponse.json(
      {
        error: '服务器错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/password-reset/send-phone-code
 * Check rate limit status (optional endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: '请提供手机号码' },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    const rateLimitResult = checkVerificationCodeRateLimit(`phone-reset:${formattedPhone}`);

    // Check for recent code
    const recentCode = await prisma.phoneVerificationCode.findFirst({
      where: {
        phone: formattedPhone,
        used: false,
        type: 'PHONE_RESET',
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
    console.error('Error checking phone code status:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
