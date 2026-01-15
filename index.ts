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
        }
    },
    fetch: (req) => {
        return new Response("404 Not Found", {
            status: 404,
        })
    }
});