import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import { Readable } from 'stream';
import crypto from 'crypto';
import { PassThrough } from 'stream';

/**
 * MaxMind GeoIP2 数据库自动更新脚本
 * 参考：https://dev.maxmind.com/geoip/updating-databases/
 */

class GeoIPUpdater {
    constructor(config) {
        this.accountId = config.accountId || process.env.MAXMIND_ACCOUNT_ID;
        this.licenseKey = config.licenseKey || process.env.MAXMIND_LICENSE_KEY;
        this.downloadPath = config.downloadPath || process.env.GEOIP_DOWNLOAD_PATH || './geoip_databases';
        this.editions = config.editions || ['GeoLite2-ASN', 'GeoLite2-City'];
        this.baseUrl = 'https://download.maxmind.com/geoip/databases';
        
        if (!this.accountId || !this.licenseKey) {
            throw new Error('必须配置 MaxMind Account ID 和 License Key');
        }
    }

    /**
     * 获取数据库下载 URL（使用永久链接）
     */
    getDownloadUrl(edition) {
        const editionMap = {
            'GeoLite2-ASN': 'GeoLite2-ASN',
            'GeoLite2-City': 'GeoLite2-City'
        };
        const dbName = editionMap[edition] || edition;
        return `${this.baseUrl}/${dbName}/download?suffix=tar.gz`;
    }

    /**
     * 获取认证头
     */
    getAuthHeader() {
        const auth = Buffer.from(`${this.accountId}:${this.licenseKey}`).toString('base64');
        return `Basic ${auth}`;
    }

    /**
     * 下载单个数据库文件
     */
    async downloadDatabase(edition) {
        console.log(`[${new Date().toISOString()}] 开始下载 ${edition}...`);
        
        const url = this.getDownloadUrl(edition);
        const tempFile = path.join(this.downloadPath, `${edition}.tar.gz`);
        const extractPath = path.join(this.downloadPath, edition);
        
        try {
            // 确保下载目录存在
            if (!fs.existsSync(this.downloadPath)) {
                fs.mkdirSync(this.downloadPath, { recursive: true });
            }

            // 下载文件
            const response = await fetch(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'User-Agent': 'GeoIP-Updater/1.0'
                },
                redirect: 'follow' // 跟随重定向
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('认证失败：请检查 Account ID 和 License Key');
                }
                if (response.status === 404) {
                    throw new Error(`数据库不存在：${edition}`);
                }
                throw new Error(`下载失败：HTTP ${response.status}`);
            }

            // 保存 tar.gz 文件
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(tempFile, buffer);
            
            console.log(`[${new Date().toISOString()}] ${edition} 下载完成，保存到 ${tempFile}`);

            // 解压文件
            await this.extractDatabase(tempFile, extractPath, edition);

            // 保留压缩包文件用于版本检查，不删除

            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] 下载 ${edition} 失败:`, error.message);
            throw error;
        }
    }

    /**
     * 解压 tar.gz 文件
     */
    async extractDatabase(gzFile, extractPath, edition) {
        return new Promise((resolve, reject) => {
            try {
                // 确保解压目录存在
                if (!fs.existsSync(extractPath)) {
                    fs.mkdirSync(extractPath, { recursive: true });
                }

                const gzipped = fs.createReadStream(gzFile);
                const extractor = zlib.createGunzip();
                
                // 读取 tar 文件内容
                const tarChunks = [];
                const tarStream = new PassThrough();
                
                gzipped
                    .pipe(extractor)
                    .pipe(tarStream);

                extractor.on('error', reject);

                // 简单的 tar 解析（只提取 .mmdb 文件）
                let buffer = Buffer.alloc(0);
                
                tarStream.on('data', (chunk) => {
                    buffer = Buffer.concat([buffer, chunk]);
                });

                tarStream.on('end', () => {
                    try {
                        // 解析 tar 格式
                        this.parseTarAndExtract(buffer, extractPath, edition);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });

                tarStream.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 解析 tar 文件并提取 .mmdb 文件
     */
    parseTarAndExtract(buffer, extractPath, edition) {
        let offset = 0;
        
        while (offset < buffer.length - 512) {
            // 读取 tar 文件头
            const header = buffer.slice(offset, offset + 512);
            
            // 检查是否是空块（文件结束）
            if (header.slice(0, 100).every(b => b === 0)) {
                break;
            }

            // 解析文件名（0-99 字节）
            const filenameBytes = header.slice(0, 100);
            const nullIndex = filenameBytes.indexOf(0);
            const filename = filenameBytes.slice(0, nullIndex > 0 ? nullIndex : 100).toString('utf8').trim();

            // 解析文件大小（124-135 字节，八进制）
            const sizeBytes = header.slice(124, 136);
            const sizeStr = sizeBytes.toString('utf8').trim().replace(/\0/g, '');
            const fileSize = parseInt(sizeStr, 8) || 0;

            // 如果是 .mmdb 文件，提取它
            if (filename.endsWith('.mmdb')) {
                const fileData = buffer.slice(offset + 512, offset + 512 + fileSize);
                const outputFileName = path.basename(filename);
                const outputPath = path.join(extractPath, outputFileName);
                
                fs.writeFileSync(outputPath, fileData);
                console.log(`  ✓ 提取文件：${outputPath}`);
            }

            // 移动到下一个文件头（512 字节对齐）
            const paddedSize = Math.ceil(fileSize / 512) * 512;
            offset += 512 + paddedSize;
        }
    }

    /**
     * 下载所有数据库
     */
    async downloadAll() {
        console.log(`[${new Date().toISOString()}] 开始更新 GeoIP 数据库...`);
        console.log(`  Account ID: ${this.accountId}`);
        console.log(`  数据库列表：${this.editions.join(', ')}`);
        console.log(`  下载路径：${path.resolve(this.downloadPath)}`);
        console.log('---');

        const results = [];
        
        for (const edition of this.editions) {
            try {
                // 先检查本地压缩包是否存在
                const localTarPath = path.join(this.downloadPath, `${edition}.tar.gz`);
                const localTarMd5 = fs.existsSync(localTarPath) ? this.getFileMD5(localTarPath) : null;
                
                // 使用 HEAD 请求检查远程版本
                console.log(`[${new Date().toISOString()}] 检查 ${edition} 远程版本...`);
                const remoteInfo = await this.checkVersion(edition);
                
                if (remoteInfo.status === 'error') {
                    throw new Error(`检查远程版本失败: ${remoteInfo.message || '未知错误'}`);
                }
                
                console.log(`[${new Date().toISOString()}] 远程版本 ETag: ${remoteInfo.etag || 'N/A'}`);
                
                // 比较本地压缩包 MD5 和远程 ETag，只有在版本不匹配时才下载
                if (localTarMd5 && remoteInfo.etag) {
                    if (localTarMd5 === remoteInfo.etag) {
                        console.log(`[${new Date().toISOString()}] ${edition} 压缩包版本最新，跳过下载`);
                        results.push({ edition, success: true, skipped: true });
                        continue;
                    }
                    console.log(`[${new Date().toISOString()}] 本地压缩包 MD5: ${localTarMd5}`);
                }
                
                await this.downloadDatabase(edition);
                results.push({ edition, success: true });
            } catch (error) {
                results.push({ edition, success: false, error: error.message });
            }
        }

        console.log('---');
        console.log(`[${new Date().toISOString()}] 更新完成`);
        
        // 打印结果摘要
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        const skippedCount = results.filter(r => r.skipped).length;
        console.log(`  跳过：${skippedCount}, 成功：${successCount}, 失败：${failCount}`);
        
        if (failCount > 0) {
            console.log('\n失败的数据库:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.edition}: ${r.error}`);
            });
        }

        return results;
    }

    /**
     * 获取本地数据库文件路径
     */
    getLocalDbPath(edition) {
        const extractPath = path.join(this.downloadPath, edition);
        if (!fs.existsSync(extractPath)) {
            return null;
        }
        const mmdbFiles = fs.readdirSync(extractPath).filter(f => f.endsWith('.mmdb'));
        return mmdbFiles.length > 0 ? path.join(extractPath, mmdbFiles[0]) : null;
    }

    /**
     * 计算文件的 MD5 哈希值
     */
    getFileMD5(filePath) {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * 检查远程数据库版本（使用 HEAD 请求，不下载文件）
     * @returns {Promise<{md5: string|null, etag: string|null, lastModified: string|null, status: string, response?: Response}>} 返回远程文件的校验信息
     */
    async checkVersion(edition) {
        try {
            const url = this.getDownloadUrl(edition);
            console.log(`[HEAD] ${url}`);
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'User-Agent': 'GeoIP-Updater/1.0'
                },
                redirect: 'follow' // 跟随重定向
            });
            
            console.log(`[HEAD] 响应状态: ${response.status} ${response.statusText}`);
            
            if (response.ok || response.status === 302) {
                const headersInfo = {};
                response.headers.forEach((value, key) => {
                    headersInfo[key] = value;
                });
                console.log(`[HEAD] 响应头:`, JSON.stringify(headersInfo, null, 2));
                
                // 优先使用 ETag（MaxMind 使用 ETag 而不是 Content-MD5）
                const etag = response.headers.get('ETag') || response.headers.get('Content-MD5');
                
                return {
                    etag: etag ? etag.replace(/"/g, '') : null, // 移除引号
                    lastModified: response.headers.get('Last-Modified'),
                    status: 'ok',
                    response
                };
            }
            return { 
                etag: null, 
                lastModified: null, 
                status: 'error',
                message: `HTTP ${response.status}: ${response.statusText}`
            };
        } catch (error) {
            console.error(`[HEAD] 请求失败:`, error);
            return { 
                etag: null, 
                lastModified: null, 
                status: 'error', 
                message: error.message || '未知错误',
                stack: error.stack
            };
        }
    }
}

// 如果需要直接运行此脚本
if (process.argv[1]?.endsWith('update-db.js')) {
    (async () => {
        try {
            const updater = new GeoIPUpdater({
                accountId: process.env.MAXMIND_ACCOUNT_ID,
                licenseKey: process.env.MAXMIND_LICENSE_KEY,
                downloadPath: process.env.GEOIP_DOWNLOAD_PATH || './geoip_databases',
                editions: (process.env.GEOIP_EDITIONS || 'GeoLite2-ASN,GeoLite2-City').split(',')
            });

            await updater.downloadAll();
            
            // 输出更新后的文件路径
            console.log('\n更新后的数据库文件路径:');
            const downloadPath = process.env.GEOIP_DOWNLOAD_PATH || './geoip_databases';
            const editions = (process.env.GEOIP_EDITIONS || 'GeoLite2-ASN,GeoLite2-City').split(',');
            
            editions.forEach(edition => {
                console.log(`  ${edition}: ${path.join(downloadPath, edition)}/`);
            });
            
            console.log('\n请更新环境变量:');
            console.log(`  ASN_DB_PATH=${path.join(downloadPath, 'GeoLite2-ASN', 'GeoLite2-ASN.mmdb')}`);
            console.log(`  CITY_DB_PATH=${path.join(downloadPath, 'GeoLite2-City', 'GeoLite2-City.mmdb')}`);
            
        } catch (error) {
            console.error('更新失败:', error.message);
            process.exit(1);
        }
    })();
}

// 导出供其他模块使用
export { GeoIPUpdater };
