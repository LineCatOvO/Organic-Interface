---
project: Organic-Interface
last_updated: 2026-06-28 03:00
updated_by: Reviewer (闭环阶段 - task-P1-009)
total_issues: 8 (open: 1, verified_closed: 7)
---

# Organic-Interface 项目问题清单

## 问题记录

| 编号     | 发现时间   | 发现来源 | 问题类型 | 严重级别 | 问题描述                                                                                    | 复现条件                                 | 关联任务文档                                      | 关联测试               | 状态            | 修复版本 | 关闭时间   |
| -------- | ---------- | -------- | -------- | -------- | ------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- | ---------------------- | --------------- | -------- | ---------- |
| P-OI-001 | 2026-06-14 | 任务执行 | 配置     | MEDIUM   | Dockerfile 中 pnpm 版本与 package.json 不一致（9.1.0 vs 10.28.1）                           | 查看 Dockerfile 和 package.json          | pending-task-P0-organic-interface-verify          | —                      | verified_closed | 待提交   | 2026-06-14 |
| P-OI-002 | 2026-06-14 | 任务执行 | 配置     | LOW      | 子包 package.json 的 test/lint 脚本均为占位符（echo）                                       | 查看各子包 package.json                  | pending-task-P0-organic-interface-verify          | —                      | verified_closed | 待提交   | 2026-06-14 |
| P-OI-003 | 2026-06-14 | 任务执行 | 文档     | LOW      | AGENTS_README.md 大量字段为"待补充"，缺少项目关键信息                                       | 查看 AGENTS_README.md                    | pending-task-P0-organic-interface-verify          | —                      | verified_closed | 待提交   | 2026-06-14 |
| P-OI-004 | 2026-06-14 | 任务执行 | 代码质量 | LOW      | 源码文件中存在 `no-explicit-any` 警告（6 个文件）                                           | 运行 `pnpm lint`                         | pending-task-P0-organic-interface-verify          | 现有测试套件           | verified_closed | 待提交   | 2026-06-14 |
| P-OI-005 | 2026-06-14 | 任务执行 | 代码质量 | MEDIUM   | Prettier 格式检查失败：AGENTS_README.md 和 eslint.config.js 格式不符                        | 运行 `pnpm lint`                         | pending-task-P0-organic-interface-verify          | —                      | verified_closed | 待提交   | 2026-06-14 |
| P-OI-006 | 2026-06-14 | 闭环分析 | 测试     | LOW      | PluginRegistry.ts 测试覆盖率为 0%（测试使用 mock，未直接测试 PluginRegistry 类）            | 运行 `pnpm test:coverage`                | pending-task-P2-organic-interface-open-issues-fix | PluginRegistry.test.ts | verified_closed | 待提交   | 2026-06-16 |
| P-OI-007 | 2026-06-14 | 闭环分析 | 代码质量 | LOW      | PluginLoader.ts 中 createKernelApi() stub 方法返回 `{success: false}`，调用方依赖需确保一致 | 调用未初始化 PluginLoader 的 executeTool | pending-task-P2-organic-interface-open-issues-fix | PluginLoader.test.ts   | verified_closed | 待提交   | 2026-06-16 |
| P-OI-008 | 2026-06-28 | 闭环分析 | 配置     | LOW      | GLM-4.7-Flash 模型参数与官方文档不一致：contextWindow 应为 200K（当前 128K），maxTokens 应为 128K（当前 4096）；GLM-4.5 pricing 单位可能为元/1M tokens（当前配置为元/1K tokens） | 查看 `packages/plugins/src/core-conversation/src/config/models/glm.ts` | active-task-P1-009-glm-provider-model-config | — | open | — | — |
