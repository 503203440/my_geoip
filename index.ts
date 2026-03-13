import { handleIP, initReaders } from "./handlers.js";
import { GeoIPUpdateScheduler } from "./scheduler.js";

const port = process.env.SERVER_PORT || 3000;
const enableAutoUpdate = process.env.ENABLE_AUTO_UPDATE === 'true';

let serverInstance = null;

async function startServer() {
    await initReaders();
    
    serverInstance = Bun.serve({
        port: port,
        routes: {
            "/geoip": () => {
                return new Response(Bun.file('./public/index.html'));
            },
            "/geoip/ip": handleIP,
            "/geoip/debug": async req => {
                return new Response(JSON.stringify({
                    headers: Object.fromEntries(req.headers.entries()),
                    params: new URL(req.url).searchParams,
                    url: req.url,
                    method: req.method
                }, null, 2))
            },
            "/geoip/update": async req => {
                // if (req.method !== 'POST') {
                //     return new Response('Method not allowed', { status: 405 });
                // }
                
                try {
                    const scheduler = new GeoIPUpdateScheduler();
                    const results = await scheduler.updateNow();
                    return Response.json({
                        success: true,
                        message: '数据库更新完成',
                        results
                    });
                } catch (error) {
                    return Response.json({
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    }, { status: 500 });
                }
            },
        },
        fetch: (req) => {
            const url = new URL(req.url);
            if (url.pathname.startsWith('/static/')) {
                const filePath = '.' + url.pathname;
                try {
                    const file = Bun.file(filePath);
                    return new Response(file);
                } catch (e) {
                    return new Response('File not found', { status: 404 });
                }
            }
            return new Response("404 Not Found", {
                status: 404,
            })
        }
    });

    console.log(`\n🌍 GeoIP 服务已启动`);
    console.log(`   地址：http://localhost:${port}/geoip`);
    console.log(`   IP 查询 API: http://localhost:${port}/geoip/ip?ip=124.77.252.197`);
    console.log(`   手动更新 API: http://localhost:${port}/geoip/update`);

    if (enableAutoUpdate) {
        console.log(`\n⏰ 自动更新已启用`);
        const scheduler = new GeoIPUpdateScheduler();
        scheduler.start();
    } else {
        console.log(`\n💡 提示：设置 ENABLE_AUTO_UPDATE=true 启用自动更新`);
    }

    console.log(`\n按 Ctrl+C 停止服务\n`);
}

startServer().catch(err => {
    console.error('启动服务器失败:', err);
    process.exit(1);
});
