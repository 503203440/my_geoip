import { Reader } from '@maxmind/geoip2-node';
import fs from 'fs';

// 检查数据库文件是否存在
function checkDatabaseFiles() {
    const asnPath = process.env.ASN_DB_PATH?.trim();
    const cityPath = process.env.CITY_DB_PATH?.trim();
    
    if (!asnPath || !cityPath) {
        throw new Error('环境变量 ASN_DB_PATH 和 CITY_DB_PATH 必须配置');
    }
    
    if (!fs.existsSync(asnPath)) {
        throw new Error(`ASN 数据库文件不存在: ${asnPath}`);
    }
    
    if (!fs.existsSync(cityPath)) {
        throw new Error(`City 数据库文件不存在: ${cityPath}`);
    }
}

// 检查文件是否存在
checkDatabaseFiles();

// 异步初始化读取器
let ASN_Reader = null;
let CITY_Reader = null;

async function initReaders(force = false) {
    // 如果 force 为 true 或者读取器未初始化，则重新初始化
    if (force || !ASN_Reader) {
        ASN_Reader = await Reader.open(process.env.ASN_DB_PATH?.trim());
        console.log('[Handlers] ASN_Reader 已重新初始化');
    }
    if (force || !CITY_Reader) {
        CITY_Reader = await Reader.open(process.env.CITY_DB_PATH?.trim());
        console.log('[Handlers] CITY_Reader 已重新初始化');
    }
}

/**
 * 重新加载数据库读取器
 * @param {Object} options 
 * @param {string} options.asnPath - ASN 数据库路径
 * @param {string} options.cityPath - City 数据库路径
 */
async function reloadReaders({ asnPath, cityPath }) {
    console.log('[Handlers] 正在重新加载数据库读取器...');
    
    // 更新环境变量
    if (asnPath) {
        process.env.ASN_DB_PATH = asnPath;
    }
    if (cityPath) {
        process.env.CITY_DB_PATH = cityPath;
    }
    
    // 重新初始化（Reader 对象不需要手动关闭）
    await initReaders(true);
    
    console.log('[Handlers] 数据库读取器重新加载完成');
}

/**
 * 获取当前读取器实例
 */
function getReaders() {
    return { ASN_Reader, CITY_Reader };
}

/**
 * 处理 IP 查询请求
 * @param {Request} req 
 * @returns 
 */
function handleIP(req) {
    const url = new URL(req.url);
    let ipaddr = url.searchParams.get('ip');
    console.log(`参数信息:${Array.from(url.searchParams.entries())}`)
    
    if (!ipaddr) {
        // 尝试获取x-real-ip
        ipaddr = req.headers.get('x-real-ip');
        if (!ipaddr) {
            // 从请求中获取IP（注意：Bun没有内置方法获取原始IP，只能依赖代理头）
            return new Response("获取IP地址失败", {
                status: 400,
            });
        }
    }
    
    console.log(`IP地址:`, ipaddr);
    
    try {
        const ASNResponse = ASN_Reader.asn(ipaddr);
        const CITYResponse = CITY_Reader.city(ipaddr);

        return Response.json({
            asn: ASNResponse,
            cityInfo: CITYResponse
        });
    } catch (err) {
        return new Response(JSON.stringify({
            "error": err.message,
            "ip": ipaddr
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// 导出初始化函数和处理函数
export { initReaders, reloadReaders, getReaders, handleIP };