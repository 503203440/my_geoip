import { handleIP } from "./handlers.js";



const server = Bun.serve({
    port: 3000,
    routes: {
        "/ip": handleIP,
        "/debug": async req => {
            return new Response(JSON.stringify({
                headers: Object.fromEntries(req.headers.entries()),
                params: new URLSearchParams(req.url).entries(),
                url: req.url,
                method: req.method
            }, null, 2))
        },
        "/": () => {
            return new Response(Bun.file('./public/index.html'));
        }
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