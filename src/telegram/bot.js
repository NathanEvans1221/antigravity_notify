import { Telegraf } from 'telegraf';
import { logger } from '../logger.js';
import { HistoryStore } from '../store/history.js';

export class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.pendingRequests = new Map();
    this.historyStore = new HistoryStore();
    this.approvedKeywords = (process.env.APPROVED_KEYWORDS || 'yes,y,approve,ok,好,確認,同意').split(',');
    this.deniedKeywords = (process.env.DENIED_KEYWORDS || 'no,n,deny,reject,不要,拒絕,不同意').split(',');
    this.requireWhitelist = process.env.REQUIRE_WHITELIST === 'true';
    this.setupCommands();
  }

  isKeywordAllowed(text, keywords) {
    if (!this.requireWhitelist) return true;
    return keywords.includes(text);
  }

  setupCommands() {
    this.bot.command('start', async (ctx) => {
      try {
        await ctx.reply('Antigravity Notify 已啟動！\n\n當 Antigravity IDE 需要核准時，您會收到通知。');
      } catch (error) {
        logger.error('Error handling /start command:', error);
      }
    });

    this.bot.command('status', async (ctx) => {
      try {
        await ctx.reply('✅ 服務運行中');
      } catch (error) {
        logger.error('Error handling /status command:', error);
      }
    });

    this.bot.command('history', async (ctx) => {
      try {
        const history = this.historyStore.getHistory(10);
        if (history.length === 0) {
          await ctx.reply('尚無歷史記錄');
          return;
        }

        const text = history.map(h => {
          const icon = h.action === 'approve' ? '✅' : '❌';
          const time = new Date(h.created_at).toLocaleString('zh-TW');
          return `${icon} ${h.event_type} - ${h.action}\n🕒 ${time}`;
        }).join('\n\n');

        await ctx.reply(`📋 最近核准記錄\n\n${text}`);
      } catch (error) {
        logger.error('Error handling /history command:', error);
        await ctx.reply('取得歷史記錄失敗');
      }
    });

    this.bot.command('export', async (ctx) => {
      try {
        const format = ctx.message.text.split(' ')[1] || 'json';
        
        if (format === 'csv') {
          const csv = this.historyStore.exportToCsv();
          await ctx.reply(csv || '無資料');
        } else {
          const json = this.historyStore.exportToJson();
          await ctx.reply(json || '無資料');
        }
      } catch (error) {
        logger.error('Error handling /export command:', error);
        await ctx.reply('匯出失敗');
      }
    });

    this.bot.on('text', async (ctx) => {
      try {
        const text = ctx.message.text.toLowerCase().trim();

        if (this.approvedKeywords.includes(text)) {
          if (!this.isKeywordAllowed(text, this.approvedKeywords)) {
            await ctx.reply('⚠️ 指令不在白名單中，請使用 Inline 按鈕核准');
            return;
          }
          this.handleLastPendingRequest(ctx, 'approve');
        } else if (this.deniedKeywords.includes(text)) {
          if (!this.isKeywordAllowed(text, this.deniedKeywords)) {
            await ctx.reply('⚠️ 指令不在白名單中，請使用 Inline 按鈕拒絕');
            return;
          }
          this.handleLastPendingRequest(ctx, 'deny');
        }
      } catch (error) {
        logger.error('Error handling text message:', error);
      }
    });

    this.bot.action('approve', async (ctx) => {
      try {
        const callbackData = ctx.callbackQuery.data;
        
        await ctx.answerCbQuery('已核准');
        await ctx.editMessageReplyMarkup(null);
        
        if (this.pendingRequests.has(callbackData)) {
          const callback = this.pendingRequests.get(callbackData);
          callback('approve');
          this.pendingRequests.delete(callbackData);
        }
      } catch (error) {
        logger.error('Error handling approve action:', error);
        await ctx.answerCbQuery('處理失敗');
      }
    });

    this.bot.action('deny', async (ctx) => {
      try {
        const callbackData = ctx.callbackQuery.data;
        
        await ctx.answerCbQuery('已拒絕');
        await ctx.editMessageReplyMarkup(null);
        
        if (this.pendingRequests.has(callbackData)) {
          const callback = this.pendingRequests.get(callbackData);
          callback('deny');
          this.pendingRequests.delete(callbackData);
        }
      } catch (error) {
        logger.error('Error handling deny action:', error);
        await ctx.answerCbQuery('處理失敗');
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
    
    const maxRetries = 3;
    const retryDelay = 5000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.bot.launch({
          polling: {
            timeout: 0,
            limit: 1,
            allowed_updates: []
          }
        });
        logger.info('Telegram Bot started');
        return;
      } catch (error) {
        logger.warn(`Bot launch attempt ${attempt} failed: ${error.message}`);
        if (attempt < maxRetries) {
          logger.info(`Retrying in ${retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
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
    const eventType = event?.type || 'Unknown';
    const eventMessage = event?.message || '請確認此操作';
    return `🔔 *核准請求*\n\n*類型:* ${eventType}\n*訊息:* ${eventMessage}\n\n請選擇要執行的動作:`;
  }

  async stop() {
    try {
      this.bot.stop();
      this.historyStore.close();
      logger.info('Telegram Bot stopped');
    } catch (error) {
      logger.error('Error stopping Telegram Bot:', error);
    }
  }
}
