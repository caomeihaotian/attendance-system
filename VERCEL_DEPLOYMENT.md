# Vercel 部署指南

本项目部署到 Vercel 需要以下配置步骤：

## 📋 必需的环境变量

在 Vercel 项目设置中添加以下环境变量：

### 数据库配置
- `DATABASE_URL`: Neon PostgreSQL 池化连接字符串
  ```
  postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true
  ```

- `DATABASE_URL_UNPOOLED`: Neon PostgreSQL 直接连接字符串
  ```
  postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```

### 认证配置
- `NEXTAUTH_SECRET`: 使用以下命令生成：
  ```bash
  openssl rand -base64 32
  ```

- `NEXTAUTH_URL`: 你的 Vercel 部署域名
  ```
  https://your-project.vercel.app
  ```

## 🚀 部署步骤

1. **连接 GitHub 仓库**
   - 在 Vercel 中导入项目
   - 选择你的 GitHub 仓库

2. **配置环境变量**
   - 进入项目 Settings → Environment Variables
   - 添加上述所有环境变量
   - 确保应用到 Production, Preview, Development 环境

3. **部署**
   - 提交代码到 GitHub 主分支会自动触发部署
   - 或者手动在 Vercel 控制台触发部署

4. **数据库初始化**（仅首次）
   - 本地运行数据库迁移：
     ```bash
     pnpm run db:migrate
     ```
   - 或在 Vercel 上设置构建命令包含迁移：
     ```bash
     prisma migrate deploy && prisma generate && next build
     ```

## 🔧 技术细节

- **包管理器**: 使用 pnpm
- **构建命令**: `prisma generate && next build`
- **框架**: Next.js 16 with App Router
- **数据库**: PostgreSQL with Prisma ORM
- **认证**: NextAuth.js

## ⚠️ 常见问题

### 构建失败
- 确保所有环境变量都已正确配置
- 检查 `DATABASE_URL` 和 `DATABASE_URL_UNPOOLED` 是否有效
- 确保 Neon 数据库允许 Vercel IP 地址连接

### 运行时错误
- 检查 `NEXTAUTH_URL` 是否正确设置为部署域名
- 确保 Prisma Client 已生成：`prisma generate`
- 查看部署日志获取详细错误信息

## 📱 部署后

1. 访问你的 Vercel 域名测试应用
2. 创建管理员账户（需要手动实现或通过数据库）
3. 配置自定义域名（可选）
4. 设置环境特定的配置（可选）
