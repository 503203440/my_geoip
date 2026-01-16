
import { Reader } from '@maxmind/geoip2-node';
import fs from 'fs';

// const Reader = require('@maxmind/geoip2-node').Reader;
// Reader.open('/path/to/maxmind-database.mmdb').then((reader) => {
//     const response = reader.city('128.101.101.101');
//     console.log(response.country.isoCode);
// });
// Synchronous database opening
// const fs = require('fs');
// const Reader = require('@maxmind/geoip2-node').Reader;
const asn_db_file = Bun.file(process.env.ASN_DB_PATH.trim());
const city_db_file = Bun.file(process.env.CITY_DB_PATH.trim());
const asnDBExists = await asn_db_file.exists();
const cityDBExists = await city_db_file.exists();
if (!asnDBExists || !cityDBExists) {
    console.error(`Bun 确认文件不存在:asnDB:${process.env.ASN_DB_PATH.trim()}, cityDB:${process.env.CITY_DB_PATH.trim()}`);
    process.exit(1)
}
const ASN_DB_Buffer = Buffer.from(await asn_db_file.arrayBuffer());
const CITY_DB_Buffer = Buffer.from(await city_db_file.arrayBuffer())
// This reader object should be reused across lookups as creation of it is
// expensive.
const ASN_Reader = Reader.openBuffer(ASN_DB_Buffer);
const CITY_Reader = Reader.openBuffer(CITY_DB_Buffer);


/**
 * 
 * @param {Request} req 
 * @returns 
 */
function handleIP(req) {
    const url = new URL(req.url);
    let ipaddr = url.searchParams.get('ip');
    console.log(`参数信息:${Array.from(url.searchParams.entries())}`)
    if (!ipaddr) {
        // 尝试获取x-real-ip
        ipaddr = req.headers.get('x-real-ip')
        if(!ipaddr){
            let requestIP = this.requestIP(req)
            if (requestIP) {
                ipaddr = requestIP.address;
            } else {
                return new Response("获取IP地址失败", {
                    status: 400,
                })
            }
        }
    }
    console.log(`IP地址:`, ipaddr);
    try {
        const ASNResponse = ASN_Reader.asn(ipaddr);
        const CITYResponse = CITY_Reader.city(ipaddr);

        return Response.json({
            asn: ASNResponse,
            cityInfo: CITYResponse
        })
    } catch (err) {
        return new Response(JSON.stringify({
            "error": err.message,
            "ip": ipaddr
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }
}

export {
    handleIP
}