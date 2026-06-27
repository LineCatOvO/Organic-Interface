# Organic-Interface AGENTS_README

> 最后更新: 2026-06-28 | 更新者: Reviewer (闭环阶段 - task-P1-008)

## 项目概述

- **项目名称**: Organic-Interface
- **项目简介**: Plugin-based Agent Framework — 基于插件架构的 AI Agent 框架，提供内核、插件系统、工具服务、存储和 CLI 交互能力
- **技术栈**: TypeScript (monorepo, pnpm + turbo), Node.js
- **项目状态**: 开发中

## 📐 项目架构概览图

### Monorepo 包结构及依赖关系

```
                    ┌─────────────────────────────────────────┐
                    │          @organic/ui (CLI 界面)         │
                    │    └── CLI, Prompt, UIAgent, UIOperation   │
                    └──────────────┬──────────────────────────┘
                                   │ depends on
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐      ┌───────────────────┐     ┌───────────────────┐
│ @organic/agent │      │  @organic/kernel   │     │ @organic/tools    │
│               │      │                   │     │                   │
│ • WorkflowEng │◄────►│ • Kernel          │◄────►│ • ToolRegistry   │
│ • AgentRegist │      │ • PluginManager   │     │ • ToolExecutor   │
│ • ContextMgr  │      │ • TextService     │     │ • BuiltinTools    │
│ • TaskQueue   │      │ • LifecycleState  │     │   (File, Search,  │
│               │      │                   │     │    Shell, etc.)   │
└───────┬───────┘      └─────────┬─────────┘     └─────────┬─────────┘
        │                        │                         │
        │ depends on             │ depends on               │
        ▼                        ▼                         ▼
┌───────────────┐      ┌───────────────────┐              │
│@organic/plugins│      │ @organic/storage  │              │
│               │      │                   │              │
│ • BasePlugin   │      │ • StorageManager  │              │
│ • PluginLoader │      │ • MemoryStorage   │              │
│ • PluginRegistry│     │ • FileStorage     │              │
│ • CoreConversation│   │ • DatabaseStorage │              │
│               │      │ • SessionPersist  │              │
└───────┬───────┘      └───────────────────┘              │
        │                                               │
        ▼                                               ▼
┌───────────────────────────────────────────────────────────┐
│                  @organic/utils (基础工具库)                │
│           Logger, Errors, Types, Helpers                 │
└───────────────────────────────────────────────────────────┘

### 统一接口层

```
                    ┌─────────────────────────────────────────┐
                    │         @organic/interface (接口契约)     │
                    │  └── AgentFacade, KernelFacade,         │
                    │      ToolFacade, StorageFacade,         │
                    │      EventFacade, OperationTypes        │
                    └─────────────────────────────────────────┘
```

@organic/interface 是纯接口包，定义 Web/TUI 前端共用的功能契约，零运行时依赖。
```

### 核心数据流

```
用户请求 → CLI → Kernel → PluginManager → Agent → WorkflowEngine → Task Execution
                                                    ↓
                                              StorageService ← Tools
```

## 🔧 核心模块职责说明

### 1. `@organic/kernel` - 内核模块

**职责**：

- 系统生命周期管理（初始化、运行、停止）
- 插件注册与管理中心
- 文本服务与格式化
- API 暴露与路由

**关键类**：

- `Kernel`: 主入口，管理全局状态
- `PluginManager`: 插件注册、发现、依赖解析
- `TextService`: 文本格式化、输出处理
- `LifecycleState`: 状态枚举（INITIALIZING → READY → RUNNING → STOPPED）

### 2. `@organic/plugins` - 插件系统

**职责**：

- 插件基类定义与生命周期管理
- 插件加载器（本地/远程）
- 插件注册表与发现机制
- 核心会话插件实现

**关键类**：

- `BasePlugin`: 抽象基类，定义 initialize/execute/shutdown 接口
- `PluginLoader`: 负责插件的动态加载与验证
- `PluginRegistry`: 维护已注册插件的状态
- `OutputFormatter`: 多种输出格式支持（text/json/table/markdown）

### 3. `@organic/storage` - 存储抽象层

**职责**：

- 统一存储接口定义（IStorageBackend）
- 多后端实现（Memory/File/Database）
- 存储服务封装（CRUD + 查询）
- 会话持久化管理

**关键类**：

- `StorageManager`: 存储实例管理，支持多存储并行
- `StorageService`: 高级 CRUD 操作，索引支持
- `MemoryStorage`: 内存实现（测试/开发用）
- `FileStorage`: JSON 文件持久化
- `DatabaseStorage`: 结构化数据存储
- `SessionPersistenceStorage`: 会话状态持久化

### 4. `@organic/agent` - Agent 模块

**职责**：

- 工作流引擎（DAG 执行、并行、快照恢复）
- Agent 注册与调度
- 任务队列与优先级管理
- 上下文窗口管理

**关键类**：

- `WorkflowEngine`: 工作流编排核心
- `TaskQueue`: 优先级任务队列
- `TaskScheduler`: 任务调度器
- `AgentRegistry`: Agent 实例管理
- `ContextWindowManager`: 对话上下文管理

### 5. `@organic/tools` - 工具服务

**职责**：

- 工具注册与发现
- 工具执行引擎
- 内置工具集（文件操作、搜索、Shell 命令等）
- 工具上下文与权限控制

**关键类**：

- `ToolRegistry`: 工具注册中心
- `ToolExecutor`: 执行引擎，含沙箱隔离
- `BuiltinTools`: FileTool, SearchTool, ShellTool 等
- `ToolContext`: 执行上下文封装

### 6. `@organic/ui` - UI 组件

**职责**：

- CLI 命令行界面
- 交互式提示组件
- 用户输入处理
- 输出渲染

**关键类**：

- `CLI`: 主命令行入口
- `Prompt`: 交互式提示
- `UIAgent`: UI 操作代理
- `UIOperation`: UI 动作封装

### 7. `@organic/interface` - 统一接口契约层

**职责**：
- 定义 Web/TUI 前端共用的功能契约（纯接口，零运行时依赖）
- 六大门面接口：Agent / Kernel / Tool / Storage / Event / Operations
- 前端无关的操作类型定义（OperationType 7 种）

**关键接口**：
- `IAgentController`: Agent 生命周期管理（start/stop/pause/resume）
- `IAgentSession`: 会话管理（execute + 状态查询）
- `IKernelFacade`: Kernel 状态与配置访问
- `IPluginManager`: 插件注册/卸载/查询
- `IToolExecutor`: 工具执行与发现
- `IStorageFacade`: 统一存储 CRUD 操作
- `IEventBus`: 标准化事件发布/订阅

## 🎯 关键设计决策记录

### 决策 1: 插件系统架构

**选择**: 基于 BasePlugin 抽象类的继承模式  
**理由**:

- 强制统一的生命周期接口（initialize → execute → shutdown）
- 支持元数据声明式配置（dependencies, apiVersion）
- 便于热加载和动态扩展

**权衡**:

- ✅ 类型安全，编译时检查
- ✅ 清晰的契约定义
- ⚠️ 继承层级可能增加复杂度

### 决策 2: 工作流引擎设计

**选择**: DAG（有向无环图）+ 快照恢复机制  
**理由**:

- 支持复杂的任务依赖关系
- 并行执行提升吞吐量
- 快照恢复保证容错性

**特性**:

- 最大并行度可配置（maxParallelNodes: 10）
- 支持 pause/resume/cancel 状态转换
- 自动失败重试与超时隔离

### 决策 3: 存储抽象层

**选择**: Strategy Pattern（策略模式）+ 统一接口  
**理由**:

- 后端透明切换（Memory ↔ File ↔ Database）
- 开发环境用 Memory 提升速度，生产环境用 File/Database
- 便于测试 mock

**接口约束**:

```typescript
interface IStorageBackend {
  initialize(): Promise<void>;
  get(id: string): Promise<StorageEntity | null>;
  set(entity: StorageEntity): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
```

## 🚀 快速启动

### 构建命令

```bash
pnpm install            # 安装依赖
pnpm build              # 构建所有包 (turbo run build)
pnpm dev                # 开发模式 (turbo run dev)
```

### CLI 使用

```bash
npx organic-interface --help       # 查看帮助信息
npx organic-interface --version    # 查看版本号
npx organic-interface help         # 列出可用子命令
npx organic-interface history      # 查看命令历史
npx organic-interface log          # 查看操作日志
```

### 测试命令

```bash
pnpm test               # 运行所有测试 (vitest run)
pnpm test:watch         # 监听模式
pnpm test:coverage      # 覆盖率报告
pnpm vitest run e2e/     # 仅运行 E2E 测试
```

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (实际使用 10.28.1)
- TypeScript 5.4+

## 🏗️ 开发环境搭建指南增强版

### 首次设置（完整版）

```bash
# 1. 克隆仓库
git clone <repo-url>
cd Organic-Interface

# 2. 安装 pnpm（如未安装）
npm install -g pnpm

# 3. 安装依赖
pnpm install

# 4. 验证环境
pnpm build          # 应该显示 8/8 包构建成功
pnpm test           # 应该显示所有测试通过
pnpm lint           # 应该显示 0 errors
```

### 推荐的 IDE 配置

- **VSCode 扩展**: ESLint, Prettier, TypeScript Import Sorter
- **设置**:
  - `"editor.formatOnSave": true`
  - `"editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }`
  - `[typescript]: { "editor.defaultFormatter": "esbenp.prettier-vscode" }`

### 常见问题排查

| 问题                | 可能原因             | 解决方案                         |
| ------------------- | -------------------- | -------------------------------- |
| `pnpm build` 缺少包 | workspace 未正确链接 | 删除 node_modules + pnpm install |
| TypeScript 类型错误 | 未运行 build         | 先执行 pnpm build 生成类型       |
| 测试导入路径错误    | 包未正确导出         | 检查 package.json exports 字段   |
| ESLint 版本警告     | TS 5.9.3 兼容性问题  | 可忽略或降级至 TS 5.6.0          |

## 🧪 测试策略说明

### 测试分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    E2E 测试 (e2e/)                     │
│  • 9 个测试文件 | 129 个用例                           │
│  • 跨模块集成验证                                      │
│  • 真实场景模拟                                        │
├─────────────────────────────────────────────────────────┤
│                  集成测试 (packages/*/__tests__/)       │
│  • 多模块协作验证                                       │
│  • 存储后端切换                                         │
│  • 工作流端到端流程                                     │
├─────────────────────────────────────────────────────────┤
│                  单元测试 (packages/*/src/__tests__/)    │
│  • 86 个测试文件 | ~3130 个用例                      │
│  • 函数/方法级别验证                                    │
│  • Mock 外部依赖                                       │
└─────────────────────────────────────────────────────────┘
```

### 覆盖率目标（当前基线）

| 层级           | 当前覆盖率 | 目标 | 状态    |
| -------------- | ---------- | ---- | ------- |
| 整体语句覆盖率 | **95.32%** | ≥95% | ✅ 达标 |
| 整体分支覆盖率 | **87.21%** | ≥88% | ⚠️ 差0.79% |
| 整体函数覆盖率 | **96.25%** | ≥96% | ✅ 达标 |
| 整体行覆盖率   | **95.89%** | ≥95% | ✅ 达标 |

### E2E 测试覆盖的核心场景

1. **插件系统生命周期** (plugin-system.test.ts)
   - 加载 → 注册 → 初始化 → 执行 → 卸载
   - 依赖解析顺序
   - 并发操作安全性
   - 状态持久化

2. **工作流引擎** (workflow-engine.test.ts)
   - 创建 → 执行 → 暂停 → 恢复 → 完成
   - 快照创建与恢复
   - 并行执行与错误隔离
   - 上下文保持

3. **Agent 调度** (agent-scheduling.test.ts)
   - 多 Agent 并发协作
   - 优先级排序
   - 失败隔离
   - 工作负载分布

4. **存储集成** (storage-integration.test.ts)
   - CRUD 完整性
   - 批量操作
   - 并发安全
   - 数据一致性

## 📦 构建与部署流程说明

### 本地开发构建流程

```bash
# 1. 代码检查 (Lint)
pnpm lint
# 预期: 0 errors, warnings 允许

# 2. 类型检查与构建 (Build)
pnpm build
# 预期: 8/8 包成功 (utils, kernel, tools, plugins, storage, agent, ui, interface)

# 3. 单元测试 (Test)
pnpm test
# 预期: 所有测试通过 (~2906 用例)

# 4. E2E 测试 (可选，完整验证时运行)
pnpm vitest run e2e/
# 预期: 129 用例全部通过
```

### CI/CD 流程 (.github/workflows/ci.yml)

```
触发条件: push / PR to agent-develop
    │
    ├─ Step 1: Lint (ESLint + Prettier)
    │   └─ 失败 → 阻止合并
    │
    ├─ Step 2: Build (Turbo - 8 packages)
    │   └─ 失败 → 阻止合并
    │
    ├─ Step 3: Test (Vitest - 全量)
    │   ├─ Unit Tests (79 files)
    │   ├─ Integration Tests
    │   └─ E2E Tests (9 files)
    │   └─ 失败 → 阻止合并
    │
    └─ Step 4: Coverage Report
        └─ 生成覆盖率报告供审查
```

### Docker 构建（可选）

```bash
# 构建镜像
docker build -t organic-interface .

# 运行容器（前台模式，强制）
docker compose --profile dev up --build
```

## 特殊规范

- **分支策略**: agent-develop 单分支开发
- **提交规范**: conventional commits (`type(scope): subject`)
- **代码规范**: ESLint (@typescript-eslint) + Prettier
- **测试要求**: vitest 测试框架，88 个测试文件，~2906 个测试用例，整体语句覆盖率 94.5%+

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

- 测试文件中存在 ~342 个 `no-explicit-any` warnings（仅测试文件，源码已清理），属于测试代码中的合理实践
- `PluginRegistry.ts` 测试覆盖率已从 0% 提升至 99.02%（P-OI-006 已关闭）
- `PluginLoader.ts` 中 `createKernelApi()` 的 executeTool 已从 stub 替换为真实实现（P-OI-007 已关闭）
- @typescript-eslint 不完全支持当前 TypeScript 5.9.3 版本（支持范围 4.7.4-5.6.0），运行时会有警告提示但不影响功能
- `DatabaseStorage` 命名存在历史遗留（实际为 JSON 文件存储，非 SQLite），计划在未来版本重构
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

## 📊 性能优化建议（技术债务）

| 优化项                | 当前状态                 | 建议         | 优先级 |
| --------------------- | ------------------------ | ------------ | ------ |
| WorkflowEngine 并行度 | 固定 maxParallelNodes=10 | 动态负载均衡 | P2     |
| PluginLoader 缓存     | TTL 5 分钟               | LRU 淘汰策略 | P2     |
| Agent 心跳间隔        | 固定轮询                 | 自适应间隔   | P3     |
| DatabaseStorage 写入  | 按需保存                 | 批量写入缓冲 | P3     |

---

_文档维护记录_:

- 2026-06-28: Reviewer (task-P1-008) 新增 @organic/interface 统一接口包信息
- 2026-06-28: Reviewer (task-cli-entry-001) 新增 CLI 使用说明章节
- 2026-06-27: Reviewer (P1-001) 更新测试覆盖率基线数据（95.32%/87.21%/96.25%/95.89%）
- 2026-06-19: CORE-03 新增架构概览图、模块职责、设计决策、测试策略、构建流程章节
- 2026-06-18: 初始版本创建
