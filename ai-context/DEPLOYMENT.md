# AI Insight Daily 部署说明 V1.0


## 当前服务器环境

运行环境：

Windows + WSL2 Ubuntu


Linux用户：

administrator


项目路径：

/home/administrator/projects/ai-insight-daily



## 网络架构


公网域名：

https://aibiliai.com


访问流程：

用户

↓

nginx

↓

Next.js

↓

PM2管理进程



## Web服务

nginx


作用：

- 域名解析
- HTTPS
- 反向代理



## 应用管理

PM2


项目名称：

ai-insight-daily


常用命令：


查看状态：

pm2 status


查看日志：

pm2 logs ai-insight-daily


重启：

pm2 restart ai-insight-daily



## 构建部署流程


进入项目：

cd ~/projects/ai-insight-daily


安装依赖：

npm install


构建：

npm run build


启动：

pm2 restart ai-insight-daily



## 自动启动

当前使用：

PM2 startup

以及Windows启动WSL方案。



## 注意事项

不要随意修改：

nginx配置

PM2配置

生产环境变量


修改前先备份。


