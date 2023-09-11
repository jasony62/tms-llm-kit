# 基于alpine的nodejs编译环境
FROM node:18-alpine AS builder
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

# 修改npm源
RUN npm config set registry https://registry.npmmirror.com

# 安装基础包
RUN npm install -g pnpm typescript

# 基础工具
RUN apk add python3 make g++

# tms-llm-kit
COPY ./package.json /usr/src/tms-llm-kit/package.json
COPY ./tsconfig.json /usr/src/tms-llm-kit/tsconfig.json
COPY ./src /usr/src/tms-llm-kit/src
RUN cd /usr/src/tms-llm-kit && pnpm i --strict-peer-dependencies=false && pnpm build
RUN rm -rf /usr/src/tms-llm-kit/node_modules
RUN cd /usr/src/tms-llm-kit && pnpm i --production --strict-peer-dependencies=false

# 生产环境
FROM node:18-alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories \
  && apk update && apk add bash tzdata \
  && cp -r -f /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

COPY --from=builder /usr/src/tms-llm-kit/package.json /usr/tms-llm-kit/package.json
COPY --from=builder /usr/src/tms-llm-kit/node_modules /usr/tms-llm-kit/node_modules
COPY --from=builder /usr/src/tms-llm-kit/dist /usr/tms-llm-kit/dist

WORKDIR /usr/tms-llm-kit
