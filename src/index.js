import 'dotenv/config';
import { logger } from './logger.js';
import { CDPClient } from './cdp/client.js';
import { TelegramBot } from './telegram/bot.js';

class AntigravityNotify {
  constructor() {
    this.cdpClient = null;
    this.telegramBot = null;
    this.isRunning = false;
  }

  async start() {
    logger.info('Starting Antigravity Notify...');
    
    this.telegramBot = null;
    
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      this.telegramBot = new TelegramBot();
      try {
        await this.telegramBot.start();
      } catch (error) {
        logger.error('Failed to start Telegram Bot:', error);
        this.telegramBot = null;
      }
    } else {
      logger.warn('Telegram Bot Token 未設定，跳過通知功能');
    }
    
    this.cdpClient = new CDPClient({
      host: process.env.REMOTE_HOST || 'localhost',
      port: parseInt(process.env.REMOTE_PORT || '9222', 10)
    });
    
    try {
      await this.cdpClient.connect();
    } catch (error) {
      logger.error('Failed to connect to CDP:', error);
      throw error;
    }
    
    this.isRunning = true;
    logger.info('Antigravity Notify started successfully!');
    
    try {
      await this.cdpClient.startMonitoring((event) => {
        this.handleApprovalEvent(event);
      });
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      throw error;
    }
  }

  validateConfig() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.warn('TELEGRAM_BOT_TOKEN 未設定，將以單機模式運行');
    }
    if (!process.env.TELEGRAM_CHAT_ID) {
      logger.warn('TELEGRAM_CHAT_ID 未設定，將以單機模式運行');
    }
  }

  async handleApprovalEvent(event) {
    logger.info('Approval event detected:', event);
    
    if (this.telegramBot) {
      try {
        await this.telegramBot.sendApprovalRequest(event, (action) => {
          this.handleUserResponse(event, action);
        });
      } catch (error) {
        logger.error('Failed to send approval request:', error, { event });
      }
    } else {
      logger.info('單機模式：自動核准 (如需手動操作，請設定 Telegram Bot)');
      await this.handleUserResponse(event, 'approve');
    }
  }

  async handleUserResponse(event, action) {
    logger.info(`User responded with: ${action}`);
    
    try {
      if (action === 'approve') {
        await this.cdpClient.clickApprove();
      } else if (action === 'deny') {
        await this.cdpClient.clickDeny();
      }
    } catch (error) {
      logger.error('Failed to handle user response:', error, { action, event });
    }
  }

  async stop() {
    logger.info('Stopping Antigravity Notify...');
    this.isRunning = false;
    
    if (this.cdpClient) {
      try {
        await this.cdpClient.disconnect();
      } catch (error) {
        logger.error('Error disconnecting CDP client:', error);
      }
    }
    
    if (this.telegramBot) {
      try {
        await this.telegramBot.stop();
      } catch (error) {
        logger.error('Error stopping Telegram bot:', error);
      }
    }
    
    logger.info('Antigravity Notify stopped');
  }
}

const app = new AntigravityNotify();

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await app.stop();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.start().catch((err) => {
  logger.error('Failed to start application:', err);
  process.exit(1);
});
