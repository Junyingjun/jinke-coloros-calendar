---
name: Jinke
description: A precise, voice-first daily planner for ColorOS.
colors:
  canvas-warm: "#F6F3EF"
  phone-porcelain: "#FBF9F5"
  surface-paper: "#FEFDFB"
  surface-muted: "#F1EFEA"
  surface-pressed: "#EAE5DF"
  hairline: "#DDD8D3"
  ink-primary: "#211C17"
  ink-secondary: "#5A544D"
  ink-tertiary: "#8A857E"
  signal-vermilion: "#F9553A"
  signal-on-color: "#FDFBF9"
  signal-soft: "#FFE2D9"
  success: "#3A9956"
  warning: "#D6963B"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, ColorOS Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "31px"
    fontWeight: 720
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, ColorOS Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, ColorOS Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 590
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, ColorOS Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.35
rounded:
  sm: "12px"
  md: "18px"
  lg: "26px"
  xl: "34px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.surface-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "52px"
    padding: "0 16px"
  button-voice:
    backgroundColor: "{colors.signal-vermilion}"
    textColor: "{colors.signal-on-color}"
    rounded: "{rounded.full}"
    height: "64px"
    width: "64px"
  task-row:
    backgroundColor: "{colors.phone-porcelain}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    padding: "13px 0"
  critical-row:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  bottom-navigation:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    height: "82px"
    padding: "8px 12px"
---

# Design System: 今刻

## 1. Overview

**Creative North Star: "掌心里的系统时刻"**

今刻是一件安静、迅速、可信的个人工具。它继承 iOS 的信息克制与 ColorOS 的柔和触感，但不复制任一系统皮肤。每次进入都先回答“今天要做什么”，每次反馈都解释一个状态变化。

界面默认使用暖黑表面、近白信息和单一信号朱红，并提供跟随系统与亮色方案。日视图维持稳定的空间记忆，周/月只以临时检视层出现。容器只在项目需要独立操作时存在，开放式时间轴负责日常事项，避免“复杂项目管理工具式的多层级、标签堆叠和卡片海洋”。

**Key Characteristics:**
- Find N3 外屏逻辑画布采用 430 × 956，展开全面屏采用 860 × 956；桌面模拟器在同一窗口并排展示，两边共享状态
- 展开态以设备 50% 处折痕为不可偏移的分界线，两侧严格等宽并使用相同 30px 内边距：今日页左侧承载日期、日／月检视、进度和 DDL，右侧承载日常事项；关键页左右分别承载有 DDL 与无 DDL
- 顶部与底部使用 `env(safe-area-inset-*)`，不绘制假的系统时间、信号、电量或手势条
- 滚动层固定在机身裁切区域内，上下边缘使用透明度蒙版渐隐
- 日常事务的时间与正文都是 44px 以上编辑入口，正文末端用克制的箭头提示可编辑
- 周日期条是可点击日期选择器：今天永久使用 Signal Vermilion，选中的其他日期使用近白高亮；页面数据随日期切换
- 月检视使用完整六周网格，支持上／下月切换；点击任意日期后保留月检视，下面的事项、DDL 与完成状态随所选日期更新
- 每日页面在日常时间轴后复用关键事项卡片展示全部未完成 DDL，并按所选日期换算剩余或逾期天数
- 中文或阿拉伯数字的明确月日自动建立关键事项；关键事项卡片同时显示期限与可选的具体时刻
- 关键页铃铛进入 DDL 提醒设置，默认汇总时间可编辑并持久化；剩余天数大于 5 时只在 5 的倍数节点提醒，最后 5 天每日提醒，通知汇总任务名称和剩余天数
- DDL 具体时刻不晚于默认汇总时间时只提醒一次；晚于默认时间时保留阶段汇总并增加截止日时刻提醒
- 关键事项卡片打开字段编辑器，名称、期限、提醒、完成度和备注均可直接修改
- 编辑器只显示字段与操作，不显示“编辑日常事务”等标题或解释性副标题
- 语音确认编辑器同样直接从字段开始，不显示“已经听懂”等确认标题
- 语音创建结果不是只读摘要，而是可编辑草稿表单；名称作为第一字段并使用更高字重
- 默认暗色；更多面板提供暗色／系统／亮色三态切换，并持久化用户选择
- 日视图优先，底部仅“今日”“关键”和中央语音入口
- 150–260ms 的缩放、淡入和形变反馈
- 系统字体、等宽数字特性、44px 以上触控目标

## 2. Colors

默认暗色由暖黑表面与近白信息构成；亮色模式反转为暖瓷白与墨色。Signal Vermilion 只标记语音、当前选择和最高信号状态。

### Primary
- **Signal Vermilion** (`#F9553A`): 中央语音按钮、进度与当天截止状态。禁止用于装饰背景。

### Neutral
- **Dark Phone** (`#171512`): 默认应用主表面。
- **Dark Surface** (`#24211F`): 默认浮层、关键事项容器和底部导航。
- **Dark Ink** (`#F1EEEA`): 默认标题与主要图标。
- **Phone Porcelain** (`#FBF9F5`): 亮色应用主表面。
- **Surface Paper** (`#FEFDFB`): 亮色浮层与容器。
- **Ink Primary** (`#211C17`): 亮色标题与主要图标。
- **Hairline**: 随主题切换的低对比分隔线。

### Named Rules

**The One Signal Rule.** Signal Vermilion 在任一屏幕的占比不得超过 10%，它的稀缺性就是信号强度。

**The Warm Neutral Rule.** 禁止使用纯黑或纯白，中性色始终向暖色相轻微偏移。

## 3. Typography

**Display Font:** System UI，优先 SF Pro Display 与 ColorOS Sans
**Body Font:** 同一 System UI 栈

**Character:** 字形清晰、数字稳定、阅读节奏紧凑。标题通过重量和字号形成层级，不引入展示字体制造个性。

### Hierarchy
- **Display** (720, 31px, 1.05): 日期与主页面标题。
- **Title** (700, 16px, 1.25): 分区标题。
- **Body** (590, 15px, 1.45): 事项名称与核心内容。
- **Label** (650, 12px, 1.35): 时间、重复规则与元数据。

### Named Rules

**The Native Voice Rule.** 所有按钮、标签和数据使用同一系统字体栈，产品标签禁止使用展示字体。

## 4. Elevation

系统默认平坦，通过色调与细边界分层。设备外框使用宽而淡的环境阴影；底部导航、浮层和语音监听态才获得临时抬升。静止列表不使用阴影。

### Shadow Vocabulary
- **Device Ambient** (`0 36px 90px rgba(57,45,32,.20), 0 4px 18px rgba(57,45,32,.08)`): 仅用于浏览器中的手机设备外框。
- **Floating Control** (`0 18px 42px rgba(62,45,29,.13), 0 2px 8px rgba(62,45,29,.07)`): 底部导航和操作浮层。

### Named Rules

**The Soft Arrival Rule.** 新状态以 0.96→1 缩放和淡入出现，150–260ms 完成；禁止弹跳、橡皮筋和突兀闪现。

**The Flat-at-Rest Rule.** 日程列表和普通内容静止时无阴影，只有状态变化获得抬升。

## 5. Components

### Buttons
- **Shape:** 主操作使用柔和矩形（18px），语音入口为 64px 圆形。
- **Primary:** 墨色背景配暖白文字，高度 52px。
- **Hover / Focus:** 按下缩至 0.96；键盘焦点使用半透明 Signal Vermilion 轮廓。
- **Secondary:** 使用 Surface Muted，不增加描边或阴影。

### Chips
- **Style:** 重复规则使用 8px 圆角的低对比度 Surface Muted。
- **State:** “今天截止”使用 Signal Soft 与 Signal Vermilion 文字，并同时保留文字语义。

### Cards / Containers
- **Corner Style:** 关键事项使用 18px 圆角，浮层使用 34px 圆角。
- **Background:** Surface Paper。
- **Shadow Strategy:** 静止容器无阴影，参照 Elevation。
- **Border:** 1px Hairline。
- **Internal Padding:** 16px。

### Inputs / Fields
- **Style:** 暖白表面、1px Hairline、15px 圆角和 48px 最小高度。
- **Focus:** Signal Vermilion 低透明度外轮廓，不改变布局。
- **Error / Disabled:** 必须用文字或图标补充颜色，不允许只靠红或灰表达。

### Navigation
- 底部导航高 82px、34px 圆角，左右仅“今日”和“关键”。中央语音按钮向上抬升 13px，但保留在导航几何中心。
- 展开全面屏仍使用同一个 430px 导航组件并固定在底部中央，不随内容两栏横向拉伸。
- 关键页右上角铃铛是“通知与权限”的快捷入口，必须使用按钮语义和完整 44px 触控区；日／月选择及更多菜单直接呈现选项，不显示装饰性标题。
- 左上角更多菜单承载历史、复盘、权限、语音模型和设置。

### Voice Composer
- 监听态标题固定为“今刻助手”，使用 104px Signal Soft 圆形与克制呼吸环，不用“说出你的安排”把能力限定为创建。
- 解析态先显示操作意图、唯一目标和发生变化的字段；创建时才显示完整任务草稿。确认动作使用 Signal Vermilion。
- 删除、清空、完成、改期等写操作必须确认；查询和不完整指令只提供关闭／补充入口，不能显示“创建任务”。

### Calendar Marker & Day Archive
- 首页日期副标题默认只展示中国历法：真实节日／二十四节气优先，普通日期使用农历月日＋七十二候，保证每天有内容但不制造虚假节日。
- 标记旁的星点按钮只显示透明图标、无底色与外圈，实际触控区保持 44px，打开“今天是什么日子”底部抽屉。
- 抽屉分类为中国、全球节日、历史事件和人物纪念；人物纪念合并诞辰／逝世并在条目内标注类型，单次只呈现一条内容。
- 全球分类按需请求 Wikimedia 对应分类；普通屏与展开屏共用同一个在途请求和内存／本地缓存，避免双模拟器重复下载完整档案。
- 全球内容必须显示来源，联网失败时只回退到本地中国历法，不把未经核验的随机文案伪装为事实。

## 6. Do's and Don'ts

### Do:
- **Do** 让“今天”成为每次进入应用的默认答案。
- **Do** 使用 20px 水平边距、44px 最小触控区和 8px 间距节奏。
- **Do** 使用连续、短促、支持 reduced-motion 的系统级动效反馈状态变化。
- **Do** 用图标、文字和形状共同表达完成、逾期与无 DDL 状态。
- **Do** 让周/月视图关闭后回到同一个日视图空间。

### Don't:
- **Don't** 做“传统日历的密集网格首页”。
- **Don't** 做“复杂项目管理工具式的多层级、标签堆叠和卡片海洋”。
- **Don't** 使用“夸张插画、霓虹渐变、玻璃拟态或装饰性动效掩盖信息”。
- **Don't** 增加与日视图顶部周条重复的独立周检视；临时检视只保留日／月。
- **Don't** 使用彩色侧边条、渐变文字、嵌套卡片或弹跳动效。
