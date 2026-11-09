# 内容更新邮件通知

- 收件人**仅** `tonycter@gmail.com`（不发 QQ）。
- 发信模块在 ECS：`/opt/readcine-content-notify/notify.py`
- 发件优先 Gmail（`smtp-gmail.env` / `tonycter@gmail.com`）；失败时可备用 QQ SMTP **仅作发件通道**，收件仍是 Gmail。
- 可用性告警用的 `/opt/readcine-uptime/smtp.env` 不在此范围、不要改。
- 去重/限速状态：`/var/lib/readcine-content-notify/`
