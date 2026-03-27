// Import SMS client from Tencent Cloud SDK
const tencentcloud = require('tencentcloud-sdk-nodejs');

// Import SMS client from Tencent Cloud SDK
const SmsClient = tencentcloud.sms.v20210111.Client;

interface SendSMSParams {
  phoneNumber: string;
  code: string;
  purpose?: 'password_reset' | 'phone_verification' | 'other';
}

/**
 * Send SMS verification code using Tencent Cloud SMS
 */
export async function sendSMS({
  phoneNumber,
  code,
  purpose = 'password_reset'
}: SendSMSParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Tencent Cloud credentials are configured
    const requiredEnvVars = [
      'TENCENT_SECRET_ID',
      'TENCENT_SECRET_KEY',
      'TENCENT_SMS_APP_ID',
      'TENCENT_SMS_TEMPLATE_ID',
      'TENCENT_SMS_SIGN_NAME'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`${envVar} is not configured`);
        return {
          success: false,
          error: '短信服务未配置，请联系管理员'
        };
      }
    }

    // Initialize Tencent Cloud SMS client
    const clientConfig = {
      credential: {
        secretId: process.env.TENCENT_SECRET_ID!,
        secretKey: process.env.TENCENT_SECRET_KEY!,
      },
      region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'sms.tencentcloudapi.com',
        },
      },
    };

    const client = new SmsClient(clientConfig);

    // Clean phone number (remove +86 prefix if present)
    const cleanPhone = phoneNumber.replace(/^(\+86|86)/g, '');

    // Prepare SMS template parameters
    // The first parameter is usually the verification code
    const templateParamSet = [code];

    // Prepare request
    const params = {
      PhoneNumberSet: [`+86${cleanPhone}`],
      SmsSdkAppId: process.env.TENCENT_SMS_APP_ID!,
      TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID!,
      TemplateParamSet: templateParamSet,
      SignName: process.env.TENCENT_SMS_SIGN_NAME!,
    };

    console.log('Sending SMS with params:', {
      ...params,
      PhoneNumberSet: [`+86${cleanPhone.substring(0, 3)}****${cleanPhone.substring(7)}`]
    });

    // Send SMS
    const response = await client.SendSms(params);

    console.log('SMS response:', response);

    // Check if sending was successful
    if (response.Status && response.Status.length > 0) {
      const status = response.Status[0];

      if (status.Code === 'Ok') {
        console.log('SMS sent successfully');
        return { success: true };
      } else {
        console.error('SMS sending failed:', status.Message);
        return {
          success: false,
          error: `短信发送失败: ${status.Message || '未知错误'}`
        };
      }
    }

    return {
      success: false,
      error: '短信发送失败，请稍后重试'
    };

  } catch (error) {
    console.error('Error sending SMS:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('AuthFailure')) {
        return {
          success: false,
          error: '短信服务认证失败，请检查配置'
        };
      } else if (errorMessage.includes('phone number')) {
        return {
          success: false,
          error: '手机号码格式不正确'
        };
      } else if (errorMessage.includes('frequency')) {
        return {
          success: false,
          error: '短信发送频率过高，请稍后重试'
        };
      }
    }

    return {
      success: false,
      error: '短信发送失败，请稍后重试'
    };
  }
}

/**
 * Send password reset success notification via SMS
 */
export async function sendPasswordResetSuccessSMS({
  phoneNumber,
  userName
}: {
  phoneNumber: string;
  userName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const requiredEnvVars = [
      'TENCENT_SECRET_ID',
      'TENCENT_SECRET_KEY',
      'TENCENT_SMS_APP_ID',
      'TENCENT_SMS_SIGN_NAME'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        return {
          success: false,
          error: '短信服务未配置'
        };
      }
    }

    // For success notification, you might want to use a different template
    // This is a placeholder - you would need to create a separate template in Tencent Cloud
    const successTemplateId = process.env.TENCENT_SMS_SUCCESS_TEMPLATE_ID;

    if (!successTemplateId) {
      console.log('Success SMS template not configured, skipping notification');
      return { success: true }; // Don't fail if success notification is optional
    }

    const clientConfig = {
      credential: {
        secretId: process.env.TENCENT_SECRET_ID!,
        secretKey: process.env.TENCENT_SECRET_KEY!,
      },
      region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'sms.tencentcloudapi.com',
        },
      },
    };

    const client = new SmsClient(clientConfig);

    const cleanPhone = phoneNumber.replace(/^(\+86|86)/g, '');

    const params = {
      PhoneNumberSet: [`+86${cleanPhone}`],
      SmsSdkAppId: process.env.TENCENT_SMS_APP_ID!,
      TemplateId: successTemplateId,
      TemplateParamSet: [], // No parameters needed for success notification
      SignName: process.env.TENCENT_SMS_SIGN_NAME!,
    };

    const response = await client.SendSms(params);

    if (response.Status && response.Status.length > 0) {
      const status = response.Status[0];

      if (status.Code === 'Ok') {
        return { success: true };
      } else {
        console.error('Success SMS sending failed:', status.Message);
        return { success: true }; // Still return success since password was reset
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error sending success SMS:', error);
    return { success: true }; // Don't fail the password reset if notification fails
  }
}

/**
 * Test SMS configuration (for development/testing)
 */
export async function testSMSConfig(): Promise<{
  success: boolean;
  configured: boolean;
  error?: string
}> {
  try {
    const requiredEnvVars = [
      'TENCENT_SECRET_ID',
      'TENCENT_SECRET_KEY',
      'TENCENT_SMS_APP_ID',
      'TENCENT_SMS_TEMPLATE_ID',
      'TENCENT_SMS_SIGN_NAME'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        return {
          success: false,
          configured: false,
          error: `${envVar} not configured`
        };
      }
    }

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

/**
 * Format phone number for Tencent Cloud SMS
 * Ensures the number is in the correct format: +86 followed by 11 digits
 */
export function formatPhoneNumberForSMS(phone: string): string {
  const cleaned = phone.replace(/[\s\-+()]/g, '');

  // If it's 11 digits starting with 1, add +86 prefix
  if (/^1[3-9]\d{9}$/.test(cleaned)) {
    return `+86${cleaned}`;
  }

  // If it already has 86 prefix and is 13 digits, just add +
  if (/^86[3-9]\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return phone;
}

/**
 * Extract phone number without country code for display/storage
 */
export function extractLocalPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-+()]/g, '');

  // Remove +86 or 86 prefix if present
  if (cleaned.startsWith('86') && cleaned.length === 13) {
    return cleaned.substring(2);
  }

  return cleaned;
}
