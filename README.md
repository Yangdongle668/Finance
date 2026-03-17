# 精斗云云会计系统

> 专为个人 / 小微企业设计的全栈云端财务管理系统

[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5-1677ff?logo=antdesign)](https://ant.design)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## ✨ 功能模块

| 模块 | 功能 |
|------|------|
| 📊 **财务仪表板** | 资金总览、损益分析图、利润率、资产负债率实时展示 |
| 📝 **凭证管理** | 草稿 → 审核 → 记账 → 红字冲销完整流程，借贷平衡强制校验 |
| 📒 **账簿** | 科目余额表、明细账、总账，自动计算期初/本期/期末余额 |
| 📈 **财务报表** | 资产负债表、利润表、现金流量表 |
| 🏭 **固定资产** | 资产登记、年限平均法折旧计算 |
| 🧾 **发票管理** | 进项/销项发票录入、认证、税额统计 |
| ⚙️ **系统设置** | 科目维护、会计期间管理、用户与角色管理、结账/反结账 |

---

## 🚀 快速部署

**只需一条命令**（需要 Docker）：

```bash
git clone https://github.com/Yangdongle668/Finance.git
cd Finance
bash deploy.sh
```

浏览器访问 → `http://localhost`

默认账号：**admin / Admin@123**

> 首次构建约需 3-5 分钟，后续启动秒级响应。

---

## 🗂️ 项目架构

```
Finance/
├── server/                  # 后端：Node.js + Express + TypeScript
│   ├── src/
│   │   ├── domain/          # 领域类型（凭证/科目/期间/资产/发票/工资）
│   │   ├── infrastructure/  # SQLite 数据库 + 仓储层
│   │   ├── application/     # 业务服务层
│   │   └── api/             # REST 路由 + JWT 中间件
│   └── Dockerfile
│
├── client/                  # 前端：React 18 + Ant Design 5 + ECharts
│   ├── src/
│   │   ├── pages/           # 仪表板、凭证、账簿、报表、资产、发票、设置
│   │   ├── api/client.ts    # Axios 封装 + 完整 TypeScript 类型
│   │   └── stores/          # Zustand 全局状态
│   ├── nginx.conf           # 反向代理 + SPA 路由 + gzip
│   └── Dockerfile
│
├── docker-compose.yml       # 容器编排：server + client(nginx) + seed
├── deploy.sh                # 一键部署脚本
└── .env.example             # 配置模板
```

### 分层架构

```
Domain Types
    ↓
Infrastructure / Repositories  （SQLite 数据访问）
    ↓
Application / Services         （业务逻辑、规则校验）
    ↓
API / Routes                   （HTTP 路由、JWT 认证）
    ↓
React Frontend                 （Ant Design UI + ECharts）
```

---

## 🛠️ 技术栈

| 层次 | 技术选型 |
|------|----------|
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | Ant Design 5 |
| 数据可视化 | ECharts 5 |
| 状态管理 | Zustand |
| 后端框架 | Express 4 + TypeScript |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | JWT |
| 反向代理 | Nginx |
| 容器化 | Docker + Docker Compose |

---

## 📦 部署命令

```bash
bash deploy.sh              # 启动所有服务
bash deploy.sh stop         # 停止（数据保留）
bash deploy.sh logs         # 查看实时日志
bash deploy.sh backup       # 备份数据库
bash deploy.sh update       # 拉取新代码重新部署
bash deploy.sh clean        # ⚠️ 清除所有数据
```

自定义端口：修改 `.env` 中的 `APP_PORT=8080`，再 `bash deploy.sh restart`。

---

## 💻 本地开发

```bash
# 后端
cd server && npm install && cp .env.example .env
npm run seed   # 初始化数据库
npm run dev    # → http://localhost:3001

# 前端（新终端）
cd client && npm install
npm run dev    # → http://localhost:5173
```

---

## 🔐 安全设计

- **JWT 认证**：Token 7 天有效，登出即失效
- **角色权限**：admin / supervisor / accountant / cashier / viewer 五级
- **结账锁定**：结账后历史凭证自动锁定，防止篡改
- **借贷强校验**：API 层强制验证借贷平衡，数据库层无法写入不平衡数据
- **金额精度**：以"分"（整数）存储，彻底规避浮点精度问题

---

## 📋 默认科目表

基于**小企业会计准则**，内置约 50 个常用科目，涵盖：

资产（货币资金、应收账款、存货、固定资产…）·负债（应付账款、应交税费、短期借款…）·所有者权益·收入·成本费用·税金

---

## 📄 License

MIT © 2024
