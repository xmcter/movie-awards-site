# 内容更新邮件通知（电影资讯站）

事件驱动：`deploy/deploy.sh` 在 ECS 部署成功后调用 `/opt/readcine-content-notify/`，仅新增影片发汇总邮件到 `tonycter@gmail.com`。
去重状态：`/var/lib/readcine-content-notify/news-*.json`；每小时最多 1 封。
