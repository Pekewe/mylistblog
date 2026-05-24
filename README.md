# 发布清单总站

> 轻量级的清单内容管理与分享平台。Node.js + SQLite 驱动，零配置部署。

---

## 快速启动

```bash
# 1. 安装依赖
cd server && npm install

# 2. 启动服务
cd .. && node server/app.js
```

浏览器访问 **http://localhost:3000/index.html**

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 发布人 | publisher1 | pub123 |

---

## 文档体系

| 文档类别 | 说明 | 入口 |
|---------|------|------|
| 📋 **产品文档** | 产品概述、功能说明、需求规格、Roadmap | [docs/01-product/](docs/01-product/) |
| 🔧 **技术文档** | 架构设计、数据库设计、API文档、技术选型、开发规范 | [docs/02-technical/](docs/02-technical/) |
| 📖 **使用文档** | 快速入门、用户手册、操作指南、FAQ | [docs/03-user/](docs/03-user/) |
| 🛠 **运维文档** | 部署指南、环境配置、监控告警、故障处理、备份恢复 | [docs/04-operations/](docs/04-operations/) |

### 快速入口

- [快速入门教程](docs/03-user/01-快速入门教程.md) — 5 分钟上手
- [部署指南](docs/04-operations/01-部署指南.md) — CentOS 9 部署步骤
- [API 接口文档](docs/02-technical/03-API接口文档.md) — 所有接口定义
- [常见问题解答](docs/03-user/04-常见问题解答.md) — FAQ

---

## 技术栈

| 技术 | 用途 |
|------|------|
| **Node.js** 18+ | 运行环境 |
| **Express** 4.x | Web 框架 |
| **SQLite**（sql.js） | 数据库（零配置） |
| **bcryptjs** | 密码哈希（纯 JS） |
| **multer** | 文件上传 |
| **Vanilla JS** | 前端（无框架） |

**特点：**
- 纯 JS 栈，前后端统一语言
- SQLite 单文件数据库，无需安装数据库服务
- 无编译依赖，`npm install` 即装即用

---

## 项目结构

```
├── server/              # 后端
│   ├── app.js          # 入口 + 配置
│   ├── db/database.js  # 数据库操作层
│   ├── routes/         # API 路由
│   └── middleware/     # 中间件
├── data/               # 数据库文件
├── uploads/            # 上传文件
├── docs/               # 文档
├── api.js              # 前端 API 封装
├── common.js           # 前端共用函数
├── command.css         # 全局样式
└── *.html              # 前端页面
```

---

## 许可

本项目为个人站点项目，仅供学习交流使用。
