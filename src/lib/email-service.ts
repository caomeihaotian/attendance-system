import { Resend } from 'resend';
import { generateVerificationCode } from './verification-code';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com';
const FROM_NAME = '课堂点名系统';

// Lazy initialize Resend client
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

interface SendVerificationEmailParams {
  to: string;
  code: string;
  purpose?: 'password_reset' | 'email_verification' | 'other';
}

interface SendPasswordResetSuccessEmailParams {
  to: string;
  userName?: string;
}

/**
 * Send verification code email
 */
export async function sendVerificationEmail({
  to,
  code,
  purpose = 'password_reset'
}: SendVerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Resend API key is configured
    const resend = getResendClient();
    if (!resend) {
      console.error('RESEND_API_KEY is not configured');
      return {
        success: false,
        error: '邮件服务未配置，请联系管理员'
      };
    }

    const subject = purpose === 'password_reset'
      ? '【课堂点名系统】密码重置验证码'
      : '【课堂点名系统】验证码';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>验证码</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
            }
            .code-container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 8px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #ffffff;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .info {
              background-color: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-item {
              margin: 8px 0;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eaeaea;
              font-size: 12px;
              color: #999;
            }
            .warning {
              color: #e74c3c;
              font-size: 14px;
              text-align: center;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
              </div>
              <h1 class="title">${purpose === 'password_reset' ? '密码重置验证码' : '验证码'}</h1>
            </div>

            <div class="code-container">
              <div class="code">${code}</div>
            </div>

            <div class="info">
              <div class="info-item">📧 <strong>收件邮箱:</strong> ${to}</div>
              <div class="info-item">⏰ <strong>有效期:</strong> 5分钟</div>
              <div class="info-item">🔒 <strong>验证码:</strong> 6位数字</div>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.8;">
              您正在进行${purpose === 'password_reset' ? '密码重置' : '身份验证'}操作。请使用上面的验证码完成验证。
            </p>

            <p class="warning">
              ⚠️ 如果这不是您的操作，请忽略此邮件，您的账户安全不受影响。
            </p>

            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复</p>
              <p>© ${new Date().getFullYear()} 课堂点名系统 | 智能课堂出勤管理平台</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend API error:', error);
      return {
        success: false,
        error: '邮件发送失败，请稍后重试'
      };
    }

    console.log('Email sent successfully:', data);
    return { success: true };

  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      error: '邮件发送失败，请稍后重试'
    };
  }
}

/**
 * Send password reset success notification email
 */
export async function sendPasswordResetSuccessEmail({
  to,
  userName
}: SendPasswordResetSuccessEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.error('RESEND_API_KEY is not configured');
      return {
        success: false,
        error: '邮件服务未配置'
      };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>密码修改成功</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .success-icon {
              text-align: center;
              font-size: 60px;
              margin-bottom: 20px;
            }
            .title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #27ae60;
              margin-bottom: 20px;
            }
            .content {
              text-align: center;
              color: #666;
              font-size: 16px;
              line-height: 1.8;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eaeaea;
              font-size: 12px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1 class="title">密码修改成功</h1>
            <div class="content">
              <p>您好${userName ? `，${userName}` : ''}：</p>
              <p>您的账户密码已成功修改。</p>
              <p>如果这不是您的操作，请立即联系管理员。</p>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复</p>
              <p>© ${new Date().getFullYear()} 课堂点名系统</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: '【课堂点名系统】密码修改成功通知',
      html: htmlContent,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: '邮件发送失败' };
    }

    return { success: true };

  } catch (error) {
    console.error('Error sending password reset success email:', error);
    return { success: false, error: '邮件发送失败' };
  }
}

/**
 * Test email configuration (for development/testing)
 */
export async function testEmailConfig(): Promise<{
  success: boolean;
  configured: boolean;
  error?: string
}> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return {
        success: false,
        configured: false,
        error: 'RESEND_API_KEY not configured'
      };
    }

    const resend = getResendClient();
    if (!resend) {
      return {
        success: false,
        configured: false,
        error: 'Failed to initialize Resend client'
      };
    }

    // Test with a simple API call
    const result = await resend.domains.list({ limit: 1 });

    return {
      success: true,
      configured: true
    };

  } catch (error) {
    return {
      success: false,
      configured: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
