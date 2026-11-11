# 内容更新邮件通知（已关闭）

- **2026-11-11 用户规则：news.readcine.com、ai.readcine.com、movie.readcine.com 的资讯类和资源类内容更新一律不发邮件。**
- 发信模块仍在 ECS：`/opt/readcine-content-notify/notify.py`。hook/emit 脚本保留，但发信已用配置关闭：
  - flag 文件：`/opt/readcine-content-notify/DISABLE_EMAIL`
  - 环境变量 `CONTENT_NOTIFY_DISABLE_EMAIL` **默认 1**（关闭）
  - 重新开启需用户明确要求，并同时删除 flag 且设置 `CONTENT_NOTIFY_DISABLE_EMAIL=0`
- 调用方可继续运行 emit 管道；关闭时不发 SMTP、不写入 pending。
- 可用性/安全告警用的 `/opt/readcine-uptime/smtp.env` 不在此范围、不要改。不要改 Gmail 转发。
- 去重/限速状态：`/var/lib/readcine-content-notify/`（关闭期间模块仍可更新 seen，但不发信）。
- 若恢复发信，收件人仍只 `tonycter@gmail.com`；不要改可用性告警的收件配置。
