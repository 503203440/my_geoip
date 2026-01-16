// build.ts
await Bun.build({
    entrypoints: ['./index.ts'],
    outdir: './dist',
    target: 'bun', // 也可以是 'browser' 或 'node'
    minify: true,
    naming: "[name].[hash].[ext]", // 带有哈希的文件名，用于缓存清理
});
