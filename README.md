This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

# my_geoip

> 这是一个基于maxmind提供的geoip数据库查询ip归属地信息的服务，需要自行创建maxmind账户并下载ASN网络服务提供商数据库，city数据库放置于
> 对应的环境变量供程序读取


安装依赖

```bash
bun install
```

直接运行:

```bash
bun run index.ts
```

打包为bun可执行单js脚本

```bash
bun run build.ts
```

打包为二进制直接可以执行文件：

```bash
bun build --compile --minify ./index.ts --outfile ./dist/server

```