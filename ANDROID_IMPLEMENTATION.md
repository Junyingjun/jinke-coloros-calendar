# Android / ColorOS 实现说明

## 1.0 已落地

当前仓库已包含可签名构建的原生 Android 工程。1.0 采用 Java Activity + WebView 承载共享交互层，并通过 `JinkeAndroid` 桥接系统语音识别、日常／DDL AlarmManager、通知渠道、GitHub APK 下载与系统安装器。网页依赖随 APK 内嵌，基础任务界面无需联网启动；全球日期档案与版本检测按需联网。

日常事项的时刻、提前量、重复星期、生效区间与手动完成日期会同步到 Android SharedPreferences；原生闹钟只为当天实际生效且尚未手动完成的事项发通知。DDL 的默认提醒时间、倍数节点与最后连续提醒天数也由用户编辑并同步；每天只筛选命中策略的事项，没有命中项就不发通知，任务本身仍保留在今日与关键两份列表。开机、手动校时、日期与时区变化会重建下一次提醒。

以下 Kotlin / Compose / Room / 端侧模型内容是 1.x 后续原生化路线，不代表 1.0 已全部采用。

## 技术栈

- Kotlin + Jetpack Compose
- Room：任务、完成记录、历史与复盘快照
- AlarmManager：具体时间提醒与每天 10:00 的 DDL 倒计时
- WorkManager：月报、年报、数据清理和失败补偿
- NotificationCompat：普通通知、锁屏公开内容与操作按钮
- sherpa-onnx Kotlin API：端侧中文流式识别

## 全局语音指令层

语音转写后统一进入 `VoiceCommandRouter`，输出结构化 `VoiceCommand`，再由同一套 `TaskRepository` / `NavigationController` 执行，避免语音操作与按钮操作产生两套业务逻辑。

- `CreateTask`：创建日常事务、无 DDL 关键事项或有 DDL 关键事项。
- `DeleteTask`：删除目标任务。
- `SetCompletion`：勾选或取消勾选日常任务；关键任务完成后进入历史。
- `SetDeadline` / `ExtendDeadline`：设置期限，或按天、周、月延期。
- `UpdateTask`：修改名称、时间、重复规则、提醒偏移与备注。
- `ClearTasks` / `CompleteDailyBatch`：按日常、关键或全部范围批量清除，以及完成所选日期的全部日常事项。
- `Navigate`：打开主页面、历史、报表、权限、语音设置及日／周／月检视。
- `SelectDate` / `QuerySchedule` / `SetTheme`：切换当前周日期、查询事项概况，以及切换暗色／亮色／跟随系统。

意图识别必须先于创建解析，`CreateTask` 只接受明确的创建表达或不含操作动词的自然安排。任何含“删除、清空、修改、设置、调整、切换、查看、延期”等操作动词但信息不足的转写都返回 `ClarificationRequired`，禁止兜底为创建。目标匹配优先使用任务 ID、完整名称和用户别名，并先从转写中移除“把、给、清除、修改”等操作前缀与时长后缀。模糊匹配置信度不足或出现多个同分候选时不执行，并要求用户补充名称。删除、批量清除、完成、改期和覆盖内容等写操作必须展示结构化确认卡；只有页面跳转可由用户在设置中选择是否免确认。

语音文本进入意图识别前先执行中文口语归一化：完整消费“十一点钟”等时间表达，移除句尾“的、啊、呀、吧、呢”等语气词，再提取任务名称。普通的“明天去养老院”属于一次性日常安排；出现明确月日（含“九月十五号”等中文数字），或包含“重要、关键、特殊、DDL、截止、到期”时创建关键事项。日期附近的“大概设定在／大约安排到”等连接词不进入标题。

正式版将标题解析拆成 `TemporalPhraseExtractor`、`IntentParticleCleaner` 和 `TaskSemanticExtractor`：先分离日期、时刻、重复、提醒偏移和持续时长，再清除“什么时候、到时候、我想、帮我、的、吧、一下”等时间状语／意图词／助词，最后保留核心动词与名词对象。结果同时保存 `displayTitle`、`actionKeyword`、`objectKeyword`，例如“我想在九月十五号下午三点的时候去考驾照”→ `displayTitle=考驾照, action=考, object=驾照`。

## 中国历法与全球日期档案

- 首页 `CalendarMarkerRepository` 以中国内容为默认：法定／传统节日、二十四节气、七十二候、农历日期依次降级，任何日期都必须有真实可核验标记。
- 全球“历史上的今天”由 `OnThisDayRepository` 联网读取 Wikimedia On This Day 中文接口，UI 分类为节日、事件和人物纪念；人物纪念合并诞辰／逝世并保留类型标签。按分类懒加载，进程内相同月日和分类共用一个请求，响应写入 Room／HTTP 缓存。
- UI 必须显示 Wikimedia 来源；内容只读，不混入任务与通知数据。接口为空或失败时保留中国历法卡，不生成虚构条目。
- Android 网络层设置超时、按月日缓存键、内容长度限制与重复去除；用户可在设置中关闭全球联网内容。

`CriticalTask` 增加可空 `eventTime: LocalTime?`，DataStore 保存 `defaultDdlReminderTime`（默认 10:00）、`reminderMultiple`（默认 5）和 `finalReminderDays`（默认 5）。`CriticalReminderPolicy` 只为 `daysLeft % reminderMultiple == 0` 或 `0 <= daysLeft <= finalReminderDays` 的任务生成汇总提醒；通知列出任务名称和剩余天数。`eventTime <= defaultDdlReminderTime` 时只在截止日该时刻提醒；更晚时保留阶段汇总，并在截止日 `eventTime` 再提醒一次。修改任一策略、事件时间、延期或改期后必须替换未来 AlarmManager 请求。

结构化确认卡使用可编辑 `VoiceCommandDraft`，用户可以覆盖名称、类型、时间、重复、提醒、截止日期和备注后再执行。日常事务列表正文与时间均可打开同一 `DailyTaskEditor`；关键事项卡片打开 `CriticalTaskEditor`，可修改名称、期限、提醒、完成度和备注。编辑器只呈现字段与操作，不显示解释性标题或副标题。所有按钮编辑、语音编辑最终调用相同的 Repository 更新方法。

外观设置使用 `ThemeMode.DARK / SYSTEM / LIGHT` 三态，首次启动默认为 DARK；用户选择存入 DataStore。SYSTEM 由 `isSystemInDarkTheme()` 实时解析，状态栏、导航栏和通知预览色同步使用当前解析后的主题。

## 数据模型

### DailyTask

`id, title, time, repeatRule, reminderOffset, enabled, createdAt`

### CriticalTask

`id, title, note, deadline?, eventTime?, reminderPolicy, status, createdAt, completedAt?`

### Completion

`id, taskId, taskType, scheduledDate, completedAt, completedOnTime`

Room 对 `(taskId, scheduledDate)` 建立唯一索引，所有勾选、取消勾选和语音完成操作都使用 UPSERT 更新同一行，禁止同一天因连点或重复回调产生多条完成记录。关键事项历史使用 `(sourceTaskId, completedDate)` 做幂等键，通知按钮和应用内按钮共享同一个完成事务。

每日页使用 `selectedDate: LocalDate` 作为状态源。周条和六周月历共用这一个状态；月历支持按月前后切换，点选日期时不退出月模式。日期标题、完成率和 `DailyCompletion(taskId, selectedDate)` 同步读取；今天始终使用强调色，另一个被选日期使用近白选中态。未完成且 `deadline != null` 的关键事项通过同一查询附加到每日页，并使用 `ChronoUnit.DAYS.between(selectedDate, deadline)` 显示剩余或逾期天数。

## Find N3 与全面屏

- 外屏以 430 × 956 逻辑画布验证竖屏布局，Compose 使用窗口实际 `WindowSizeClass`，不硬编码物理像素。
- 开启 edge-to-edge，由系统绘制状态栏与手势区；内容通过 `WindowInsets.safeDrawing` 获取安全区。
- 折叠／展开或旋转后由同一个 `ViewModel` 保留当前页面、日期、完成状态与编辑结果。展开态今日页使用双栏：左栏为日期／检视／DDL，右栏为日常事项；关键页左栏为有 DDL，右栏为无 DDL。
- 底部导航在展开态仍固定于底部中央且不横向拉伸；窄屏使用 430 × 956 验证，展开态使用 860 × 956 验证。
- 展开态双栏以窗口宽度 50% 的折痕为分界，左右严格等宽；不能用内容比例或不对称 gap 推动折线。
- DDL 续期操作使用可编辑正整数，默认 7 天并限制为 1–3650 天；确认后重新计算 deadline 并替换提醒。关键页铃铛打开 DDL 默认提醒时间与今日提醒清单，系统通知权限作为该页面的次级入口。
- 列表与底部导航分层；列表只在自己的裁切区域滚动，上下渐隐使用固定遮罩，不随内容位移。

### ReportSnapshot

`periodType, periodStart, periodEnd, dailyCompletionRates, ddlLeadRanking, generatedAt`

## 提醒可靠性

1. Android 13+ 请求 `POST_NOTIFICATIONS`。
2. Android 12+ 在确有必要时引导允许精确闹钟。
3. 使用 `BOOT_COMPLETED` 与时区变更广播重新安排提醒。
4. 通知渠道设为高重要性，锁屏可见性为 `VISIBILITY_PUBLIC`。
5. ColorOS 首次设置中引导开启自启动、后台运行和“不限制”电池策略。
6. 应用每次启动执行提醒审计，补建丢失的未来闹钟。
7. 日常与 DDL 通知使用系统声音、震动和全屏提醒意图；息屏时申请短时唤醒并展示公开锁屏提醒页。Android 14+ 若未获全屏提醒许可，则引导用户进入对应系统设置。
8. 通知内容不提供完成或自动完成入口；点击通知只打开“今日”主页。通知接收器与提醒 Activity 均不写入完成状态，完成只能由用户在应用内手动勾选。

## DDL 行为

- 有 DDL：任务始终同时保留在今日与关键列表；剩余天数大于 5 时仅在 5 的倍数节点通知，最后 5 天到截止日每天通知。时间使用用户设置的默认 DDL 提醒时间，内容汇总当前任务与剩余天数；当天筛选结果为空时不创建通知。
- DDL 当天：点击通知进入“今日”主页，再由用户手动选择续期或已完成；通知本身不直接改变任务状态。
- 提前完成：立即归档，记录 `deadline - completedAt` 作为提前完成天数。
- 无 DDL：保留在关键首页，使用用户选择的回顾周期。

## 月报与年报

- 每月 1 日生成上一个自然月的完成率和日常事项排名。
- 每年 1 月 1 日生成上一自然年的完成率、日常事项排名和提前完成 DDL Top 10。
- WorkManager 负责准时生成；若设备长期关机，应用启动后执行 backfill，避免漏报。

## 模拟器策略

Web 交互原型在同一窗口并排渲染 430 × 956 普通手机和 860 × 956 展开全面屏。两个设备壳由单一状态树驱动，任一侧的页面切换、日期选择、勾选、编辑、主题和语音操作都会同步到另一侧；这用于在原生模拟器可用前验证自适应信息架构。

项目使用隔离在 `.toolchains` 下的 Microsoft OpenJDK 17、Android SDK 36 与 Gradle 8.11.1 构建，不修改系统环境。标准模拟器仍建议创建 API 35/36、x86_64 AVD，用于通知动作、重启恢复与多窗口测试。

Android Emulator 无法完整模拟 ColorOS 的自启动和电池管理策略，因此最终仍需一台 OPPO / OnePlus 真机完成以下一次性验收：

- 锁屏通知可见性
- 清理后台后的定时提醒
- 重启后的提醒恢复
- 自启动与电池“不限制”引导
- 离线中文识别的延迟、功耗与模型体积
