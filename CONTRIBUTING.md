# 贡献指南

感谢你对方界深空的关注！以下是参与项目开发的指南。

## 开发环境

### 前置条件

- Node.js ≥ 18
- npm ≥ 9
- Git
- 推荐 VS Code + Vue - Official 扩展

### 快速开始

```bash
# Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/voxel-horizon-demo.git
cd voxel-horizon-demo

# 安装依赖
npm install

# 启动开发服务器（自动打开浏览器）
npm run dev
```

## 开发流程

### 分支策略

- `main` — 稳定版本
- `feat/*` — 新功能
- `fix/*` — Bug 修复
- `docs/*` — 文档更新
- `test/*` — 测试补充

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

类型：
- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档
- `style` — 格式调整（不影响逻辑）
- `refactor` — 重构
- `test` — 测试
- `chore` — 构建/工具链

示例：
```
feat(inventory): 添加物品堆叠合并功能
fix(audio): 修复 Web Audio API 的 NaN 崩溃
test(ship): 添加飞船组件修复测试
```

## 代码规范

### TypeScript

- **严格模式**，禁止 `any` 类型
- 所有变量、参数、返回值必须有明确类型
- 使用 `import type` 导入纯类型

### Vue

- 使用 Composition API + `<script setup>`
- 组件名使用 PascalCase
- Props 使用 TypeScript 类型声明

### 测试

- 新功能必须附带测试
- Bug 修复必须附带回归测试
- 运行 `npm run test` 确保所有测试通过
- 运行 `npm run lint` 确保无 ESLint 错误

## 提交 PR

1. Fork 仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 提交更改：`git commit -m "feat: add my feature"`
4. 推送分支：`git push origin feat/my-feature`
5. 创建 Pull Request

### PR 检查清单

- [ ] `npm run typecheck` — 零类型错误
- [ ] `npm run lint` — 零 ESLint 错误
- [ ] `npm run test` — 所有测试通过
- [ ] `npm run build` — 构建成功
- [ ] 新功能附带测试
- [ ] 中文 UI 字符串风格一致

## 架构概述

### 核心模式

- **游戏引擎** (`main.ts`) — Three.js 渲染 + 游戏循环，写入 Pinia stores
- **Vue UI** (`components/`) — 从 Pinia stores 读取状态，响应式渲染
- **Pinia Stores** (`stores/`) — 桥接引擎和 UI 的状态层

### 数据流

```
游戏引擎 (main.ts)
    ↓ 写入
Pinia Stores (stores/)
    ↓ 读取
Vue 组件 (components/)
    ↓ 事件
游戏引擎
```

### 关键约定

- `this.g` — 游戏引擎中引用 Game 实例
- `this.stores` — Game 实例中访问 Pinia stores
- `syncStore()` — 引擎方法，同步状态到 Pinia
- 所有 UI 字符使用简体中文

## 问题反馈

- [GitHub Issues](https://github.com/lemonhub-io/voxel-horizon-demo/issues)
- 使用中文或英文提交均可

## 许可证

提交即表示你同意将代码以 [MIT License](LICENSE) 发布。
