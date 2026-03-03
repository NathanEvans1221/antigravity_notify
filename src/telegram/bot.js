import { Telegraf } from 'telegraf';
import { logger } from '../logger.js';
import { HistoryStore } from '../store/history.js';

export class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.pendingRequests = new Map();
    this.historyStore = new HistoryStore();
    this.setupCommands();
  }

  setupCommands() {
    this.bot.command('start', (ctx) => {
      ctx.reply('Antigravity Notify 已啟動！\n\n當 Antigravity IDE 需要核准時，您會收到通知。');
    });

    this.bot.command('status', (ctx) => {
      ctx.reply('✅ 服務運行中');
    });

    this.bot.command('history', (ctx) => {
      const history = this.historyStore.getHistory(10);
      if (history.length === 0) {
        ctx.reply('尚無歷史記錄');
        return;
      }

      const text = history.map(h => {
        const icon = h.action === 'approve' ? '✅' : '❌';
        const time = new Date(h.created_at).toLocaleString('zh-TW');
        return `${icon} ${h.event_type} - ${h.action}\n🕒 ${time}`;
      }).join('\n\n');

      ctx.reply(`📋 最近核准記錄\n\n${text}`);
    });

    this.bot.command('export', (ctx) => {
      const format = ctx.message.text.split(' ')[1] || 'json';
      
      if (format === 'csv') {
        const csv = this.historyStore.exportToCsv();
        ctx.reply(csv || '無資料');
      } else {
        const json = this.historyStore.exportToJson();
        ctx.reply(json || '無資料');
      }
    });

    this.bot.on('text', (ctx) => {
      const text = ctx.message.text.toLowerCase().trim();
      const approvedKeywords = ['yes', 'y', 'approve', 'ok', '好', '確認', '同意'];
      const deniedKeywords = ['no', 'n', 'deny', 'reject', '不要', '拒絕', '不同意'];

      if (approvedKeywords.includes(text)) {
        this.handleLastPendingRequest(ctx, 'approve');
      } else if (deniedKeywords.includes(text)) {
        this.handleLastPendingRequest(ctx, 'deny');
      }
    });

    this.bot.action('approve', async (ctx) => {
      const callbackData = ctx.callbackQuery.data;
      const requestId = ctx.callbackQuery.message?.text;
      
      await ctx.answerCbQuery('已核准');
      await ctx.editMessageReplyMarkup(null);
      
      if (this.pendingRequests.has(callbackData)) {
        const callback = this.pendingRequests.get(callbackData);
        callback('approve');
        this.pendingRequests.delete(callbackData);
      }
    });

    this.bot.action('deny', async (ctx) => {
      const callbackData = ctx.callbackQuery.data;
      
      await ctx.answerCbQuery('已拒絕');
      await ctx.editMessageReplyMarkup(null);
      
      if (this.pendingRequests.has(callbackData)) {
        const callback = this.pendingRequests.get(callbackData);
        callback('deny');
        this.pendingRequests.delete(callbackData);
      }
    });
  }

  handleLastPendingRequest(ctx, action) {
    const entries = Array.from(this.pendingRequests.entries());
    if (entries.length === 0) {
      ctx.reply('目前沒有待核准的請求');
      return;
    }

    const lastEntry = entries[entries.length - 1];
    const [key, callback] = lastEntry;
    
    ctx.reply(`${action === 'approve' ? '✅ 已核准' : '❌ 已拒絕'}`);
    callback(action);
    this.pendingRequests.delete(key);
  }

  async start() {
    logger.info('Starting Telegram Bot...');
    await this.bot.launch();
    logger.info('Telegram Bot started');
  }

  async sendApprovalRequest(event, callback) {
    const message = this.formatApprovalMessage(event);
    const requestId = `req_${Date.now()}`;
    const eventType = event.type || 'Unknown';
    const eventMessage = event.message || '';
    
    const wrappedCallback = (action) => {
      this.historyStore.addRecord(requestId, eventType, eventMessage, action);
      callback(action);
    };

    try {
      await this.bot.telegram.sendMessage(
        this.chatId,
        message,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ 核准', callback_data: `approve_${requestId}` },
                { text: '❌ 拒絕', callback_data: `deny_${requestId}` }
              ]
            ]
          }
        }
      );
      
      this.pendingRequests.set(`approve_${requestId}`, wrappedCallback);
      this.pendingRequests.set(`deny_${requestId}`, wrappedCallback);
      
      logger.info(`Approval request sent: ${requestId}`);
    } catch (error) {
      logger.error('Failed to send Telegram message:', error.message);
    }
  }

  formatApprovalMessage(event) {
    return `🔔 *核准請求*\n\n*類型:* ${event.type || 'Unknown'}\n*訊息:* ${event.message || '請確認此操作'}\n\n請選擇要執行的動作:`;
  }

  async stop() {
    this.bot.stop();
    this.historyStore.close();
    logger.info('Telegram Bot stopped');
  }
}
