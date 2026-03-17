# 课堂点名系统

基于 Next.js + Neon PostgreSQL + Three.js 构建的智能课堂出勤管理平台。

## 功能特性

- 🎓 **双角色系统**：教师/学生分离，安全认证
- 📚 **四层课程结构**：学期 → 课程 → 教学班 → 学生
- 📥 **名单批量导入**：支持 Excel(.xlsx/.xls) 和 CSV 格式
- 📋 **进度表导入**：自动解析理论课/上机课进度表生成 Session
- 🎲 **Three.js 随机点名**：粒子爆炸聚合动画，炫酷抽签效果
- ✅ **手动签到**：卡片网格，一键切换出勤/缺席/迟到/请假状态
- 📊 **出勤报表**：饼图统计、缺席名单导出 Excel
- 🔔 **今日提醒**：仪表盘高亮今日/本周需上课的课次

## 技术栈

| 技术 | 说明 |
|------|------|
| Next.js 16 | App Router, Server Components |
| Neon PostgreSQL | Serverless 数据库 |
| Prisma ORM v5 | 类型安全数据库访问 |
| NextAuth.js v5 | JWT 认证 |
| Three.js | 3D 粒子点名动画 |
| @react-three/fiber | React Three.js 渲染器 |
| Tailwind CSS v4 | 样式系统 |
| recharts | 出勤图表 |
| xlsx + papaparse | 文件解析 |

## 快速开始

### 1. 克隆并安装依赖

```bash
npm install --legacy-peer-deps
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# Neon 数据库连接串（pooled connection）
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# NextAuth 密钥（生成方法：openssl rand -base64 32）
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 推送 schema 到 Neon（开发环境）
npm run db:push

# 或使用迁移（生产环境）
npm run db:migrate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Vercel

1. 在 [Neon Console](https://console.neon.tech) 创建项目，获取连接串
2. Fork 本项目到 GitHub
3. 在 [Vercel](https://vercel.com) 导入项目
4. 配置环境变量：
   - `DATABASE_URL` - Neon 连接串（使用 pooled connection）
   - `NEXTAUTH_SECRET` - 随机字符串
   - `NEXTAUTH_URL` - 生产域名（如 `https://your-app.vercel.app`）
5. 部署后运行数据库迁移：
   ```bash
   npx prisma migrate deploy
   ```

## 使用指南

### 教师端

1. 访问 `/register` 注册教师账号
2. 登录后进入仪表盘
3. 创建学期 → 创建课程 → 创建教学班
4. 在教学班中导入学生名单（Excel/CSV）
5. 导入课程进度表（理论课.xls + 上机课.xls）
6. 点击课次 → 开始点名（随机抽签或手动签到）
7. 在报表页查看出勤统计，导出缺席名单

### 学生端

1. 使用学号登录（默认密码为学号后6位）
2. 查看课程列表和出勤记录

## 学生名单 Excel 格式

| 学号 | 姓名 | 性别 | 专业 | 班级 | 备注 |
|------|------|------|------|------|------|
| 2025001 | 张三 | 男 | 机械设计制造及其自动化 | 机械2505 | |
| 2025002 | 李四 | 女 | ... | 机械2506 | 重修 |

## 课程进度表 Excel 格式

| 周次 | 日期 | 授课内容 |
|------|------|---------|
| 1 | 2026-03-17 | 第1章 C语言概述 |
| 2 | 2026-03-24 | 第2章 数据类型 |

文件名含"理论课"→ 类型为理论课；含"上机课"→ 类型为上机课
