const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLatestVerificationCodes() {
  try {
    // 获取最新的邮箱验证码
    const emailCodes = await prisma.emailVerificationCode.findMany({
      where: {
        used: false,
        type: 'EMAIL_RESET'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        email: true,
        code: true,
        createdAt: true,
        expiresAt: true,
        type: true
      }
    });

    // 获取最新的手机验证码
    const phoneCodes = await prisma.phoneVerificationCode.findMany({
      where: {
        used: false,
        type: 'PHONE_RESET'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        phone: true,
        code: true,
        createdAt: true,
        expiresAt: true,
        type: true
      }
    });

    console.log('=== 最新邮箱验证码 ===');
    emailCodes.forEach((code, index) => {
      console.log(`${index + 1}. 邮箱: ${code.email}`);
      console.log(`   验证码: ${code.code}`);
      console.log(`   创建时间: ${code.createdAt}`);
      console.log(`   过期时间: ${code.expiresAt}`);
      console.log(`   是否过期: ${new Date() > new Date(code.expiresAt) ? '是' : '否'}`);
      console.log('');
    });

    console.log('=== 最新手机验证码 ===');
    phoneCodes.forEach((code, index) => {
      console.log(`${index + 1}. 手机: ${code.phone}`);
      console.log(`   验证码: ${code.code}`);
      console.log(`   创建时间: ${code.createdAt}`);
      console.log(`   过期时间: ${code.expiresAt}`);
      console.log(`   是否过期: ${new Date() > new Date(code.expiresAt) ? '是' : '否'}`);
      console.log('');
    });

  } catch (error) {
    console.error('查询验证码失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getLatestVerificationCodes();