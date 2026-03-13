import { GeoIPUpdater } from './update-db.js';
import { reloadReaders } from './handlers.js';

/**
 * 简单的 Cron 表达式解析器和调度器
 * 支持格式：秒 分 时 日 月 星期
 */
class CronScheduler {
    constructor(cronExpression, task) {
        this.cronExpression = cronExpression;
        this.task = task;
        this.interval = null;
        this.parts = this.parseCronExpression(cronExpression);
    }

    /**
     * 解析 Cron 表达式
     * 格式：秒 分 时 日 月 星期
     */
    parseCronExpression(expression) {
        const parts = expression.trim().split(/\s+/);
        
        if (parts.length !== 6) {
            throw new Error('Cron 表达式必须包含 6 个部分：秒 分 时 日 月 星期');
        }

        return {
            second: this.parsePart(parts[0], 0, 59),
            minute: this.parsePart(parts[1], 0, 59),
            hour: this.parsePart(parts[2], 0, 23),
            dayOfMonth: this.parsePart(parts[3], 1, 31),
            month: this.parsePart(parts[4], 1, 12),
            dayOfWeek: this.parsePart(parts[5], 0, 6)
        };
    }

    /**
     * 解析单个部分（支持 *, 数字，范围，步长）
     */
    parsePart(part, min, max) {
        if (part === '*') {
            return Array.from({ length: max - min + 1 }, (_, i) => i + min);
        }

        const values = new Set();
        
        // 处理逗号分隔的列表
        const items = part.split(',');
        
        for (const item of items) {
            // 处理步长（如 */5 或 1-10/2）
            const [range, stepStr] = item.split('/');
            const step = stepStr ? parseInt(stepStr, 10) : 1;
            
            // 处理范围（如 1-5）
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let i = start; i <= end; i += step) {
                    values.add(i);
                }
            } else {
                // 单个数字或 *
                const num = range === '*' ? min : parseInt(range, 10);
                if (isNaN(num) || num < min || num > max) {
                    throw new Error(`无效的 Cron 值：${range} (范围：${min}-${max})`);
                }
                values.add(num);
            }
        }

        return Array.from(values).sort((a, b) => a - b);
    }

    /**
     * 检查当前时间是否匹配 Cron 表达式
     */
    matches(date) {
        return (
            this.parts.second.includes(date.getSeconds()) &&
            this.parts.minute.includes(date.getMinutes()) &&
            this.parts.hour.includes(date.getHours()) &&
            this.parts.dayOfMonth.includes(date.getDate()) &&
            this.parts.month.includes(date.getMonth() + 1) &&
            this.parts.dayOfWeek.includes(date.getDay())
        );
    }

    /**
     * 计算下次执行时间
     */
    getNextExecution(from = new Date()) {
        const date = new Date(from);
        date.setMilliseconds(0);
        date.setSeconds(date.getSeconds() + 1);

        // 最多查找一年
        const maxDate = new Date(date.getFullYear() + 1, 0, 1);
        
        while (date < maxDate) {
            if (this.matches(date)) {
                return date;
            }
            date.setSeconds(date.getSeconds() + 1);
        }

        return null;
    }

    /**
     * 获取距下次执行的时间（毫秒）
     */
    getTimeToNextExecution(from = new Date()) {
        const next = this.getNextExecution(from);
        if (!next) return Infinity;
        return next.getTime() - from.getTime();
    }

    /**
     * 启动调度器
     */
    start() {
        const now = new Date();
        const delay = this.getTimeToNextExecution(now);
        
        if (delay === Infinity) {
            console.error('无法找到下次执行时间');
            return;
        }

        const nextRun = this.getNextExecution(now);
        console.log(`[Cron] 调度器已启动`);
        console.log(`[Cron] Cron 表达式：${this.cronExpression}`);
        console.log(`[Cron] 下次执行时间：${nextRun.toLocaleString('zh-CN')}`);
        console.log(`[Cron] 等待 ${Math.round(delay / 1000)} 秒`);

        const scheduleNext = () => {
            const now = new Date();
            const delay = this.getTimeToNextExecution(now);
            
            if (delay === Infinity) {
                console.error('[Cron] 无法找到下次执行时间，停止调度');
                return;
            }

            this.interval = setTimeout(() => {
                const now = new Date();
                if (this.matches(now)) {
                    console.log(`\n[Cron] ${now.toLocaleString('zh-CN')} - 执行任务...`);
                    
                    Promise.resolve(this.task())
                        .then(() => {
                            console.log(`[Cron] 任务执行完成\n`);
                        })
                        .catch((error) => {
                            console.error(`[Cron] 任务执行失败:`, error.message);
                        })
                        .finally(() => {
                            scheduleNext();
                        });
                } else {
                    scheduleNext();
                }
            }, delay);
        };

        scheduleNext();
    }

    /**
     * 停止调度器
     */
    stop() {
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
            console.log('[Cron] 调度器已停止');
        }
    }
}

/**
 * GeoIP 数据库自动更新调度器
 */
class GeoIPUpdateScheduler {
    constructor(config = {}) {
        this.cronExpression = config.cronExpression || process.env.GEOIP_UPDATE_CRON || '0 0 3 * * *'; // 默认每天凌晨 3 点
        this.updater = new GeoIPUpdater({
            accountId: config.accountId || process.env.MAXMIND_ACCOUNT_ID,
            licenseKey: config.licenseKey || process.env.MAXMIND_LICENSE_KEY,
            downloadPath: config.downloadPath || process.env.GEOIP_DOWNLOAD_PATH || './geoip_databases',
            editions: config.editions || (process.env.GEOIP_EDITIONS || 'GeoLite2-ASN,GeoLite2-City').split(',')
        });
        this.scheduler = null;
        this.running = false;
    }

    /**
     * 启动定时更新
     */
    start() {
        if (this.running) {
            console.warn('[GeoIP Scheduler] 已经在运行中');
            return;
        }

        console.log('\n=== GeoIP 数据库自动更新调度器 ===');
        console.log(`Cron 表达式：${this.cronExpression}`);
        console.log(`下载路径：${this.updater.downloadPath}`);
        console.log(`数据库：${this.updater.editions.join(', ')}`);
        console.log('================================\n');

        this.scheduler = new CronScheduler(this.cronExpression, async () => {
            try {
                const results = await this.updater.downloadAll();
                console.log('[GeoIP Scheduler] 数据库更新完成，正在重新加载读取器...');
                await reloadReaders({});
                console.log('[GeoIP Scheduler] 读取器重新加载完成\n');
                return results;
            } catch (error) {
                console.error('[GeoIP Scheduler] 更新失败:', error.message);
                throw error;
            }
        });

        this.running = true;
        this.scheduler.start();
    }

    /**
     * 停止定时更新
     */
    stop() {
        if (this.scheduler) {
            this.scheduler.stop();
            this.running = false;
        }
    }

    /**
     * 立即执行一次更新
     */
    async updateNow() {
        console.log('\n[GeoIP Scheduler] 手动触发更新...');
        try {
            const results = await this.updater.downloadAll();
            console.log('[GeoIP Scheduler] 数据库更新完成，正在重新加载读取器...');
            await reloadReaders({});
            console.log('[GeoIP Scheduler] 读取器重新加载完成\n');
            return results;
        } catch (error) {
            console.error('[GeoIP Scheduler] 手动更新失败:', error.message);
            throw error;
        }
    }
}

export { CronScheduler, GeoIPUpdateScheduler };
