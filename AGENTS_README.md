# Organic-Interface AGENTS_README

> 最后更新: 2026-06-18 | 更新者: Reviewer

## 项目概述

- **项目名称**: Organic-Interface
- **项目简介**: Plugin-based Agent Framework — 基于插件架构的 AI Agent 框架，提供内核、插件系统、工具服务、存储和 CLI 交互能力
- **技术栈**: TypeScript (monorepo, pnpm + turbo), Node.js
- **项目状态**: 开发中

## 快速启动

### 构建命令

```bash
pnpm install            # 安装依赖
pnpm build              # 构建所有包 (turbo run build)
pnpm dev                # 开发模式 (turbo run dev)
```

### 测试命令

```bash
pnpm test               # 运行所有测试 (vitest run)
pnpm test:watch         # 监听模式
pnpm test:coverage      # 覆盖率报告
```

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (实际使用 10.28.1)
- TypeScript 5.4+

## 项目结构

```
packages/
├── utils/              - 工具库（基础包，被所有其他包依赖）
├── kernel/             - 内核（核心调度、插件管理、文本服务）
├── plugins/            - 插件系统（BasePlugin、PluginLoader、PluginRegistry）
│   └── src/core-conversation/ - 核心会话插件（CLI 交互）
├── storage/            - 存储（数据库存储、文件存储、内存存储、会话持久化）
├── tools/              - 工具服务（工具注册、发现、执行）
├── agent/              - Agent（工作流引擎、Agent 注册、上下文管理）
└── ui/                 - UI 组件（CLI 界面、UI 操作）
e2e/                    - 端到端测试
```

## 特殊规范

- **分支策略**: agent-develop 单分支开发
- **提交规范**: conventional commits
- **代码规范**: ESLint (@typescript-eslint) + Prettier，配置在 eslint.config.js
- **测试要求**: vitest 测试框架，79 个测试文件，2817 个测试用例，整体语句覆盖率 92.64%

## 关键依赖

| 依赖       | 版本                        | 用途              |
| ---------- | --------------------------- | ----------------- |
| TypeScript | ^5.4.0                      | 类型系统与编译    |
| Vitest     | ^4.1.8                      | 测试框架          |
| Turbo      | ^2.9.16                     | Monorepo 构建编排 |
| ESLint     | ^9.39.4                     | 代码检查          |
| Prettier   | ^3.2.0                      | 代码格式化        |
| pnpm       | 10.28.1                     | 包管理器          |
| Node.js    | >=20 (Docker) / >=18 (开发) | 运行时            |

## 已知问题与注意事项

- 测试文件中存在 198 个 `no-explicit-any` warnings（仅测试文件，源码已清理），属于测试代码中的合理实践
- `PluginRegistry.ts` 测试覆盖率已从 0% 提升至 99.02%（P-OI-006 已关闭）
- `PluginLoader.ts` 中 `createKernelApi()` 的 executeTool 已从 stub 替换为真实实现，行为与 Kernel.executeTool 一致（P-OI-007 已关闭）
- @typescript-eslint 不完全支持当前 TypeScript 5.9.3 版本（支持范围 4.7.4-5.6.0），运行时会有警告提示但不影响功能
- 详见 `PROBLEM_INVENTORY.md`

## 外部服务/端口

| 服务 | 端口 | 说明                            |
| ---- | ---- | ------------------------------- |
| 暂无 | 暂无 | 本项目为库/框架，无外部服务端口 |

## 配置文件

| 文件路径                 | 用途                                      |
| ------------------------ | ----------------------------------------- |
| package.json             | 根项目配置，scripts、devDependencies      |
| pnpm-workspace.yaml      | Monorepo workspace 配置                   |
| turbo.json               | 构建编排任务配置                          |
| tsconfig.base.json       | 共享 TypeScript 配置                      |
| eslint.config.js         | ESLint 代码检查配置                       |
| vitest.config.ts         | Vitest 测试配置                           |
| Dockerfile               | Docker 多阶段构建镜像                     |
| docker-compose.yml       | 容器编排                                  |
| .github/workflows/ci.yml | CI 流程（lint → build → test → coverage） |
