import puppeteer from 'puppeteer-core';
import { logger } from '../logger.js';

export class CDPClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 9222;
    this.browser = null;
    this.page = null;
    this.lastState = null;
  }

  async connect() {
    logger.info(`Connecting to CDP at ${this.host}:${this.port}...`);
    
    try {
      let wsUrl = null;
      
      try {
        const response = await fetch(`http://${this.host}:${this.port}/json/version`, {
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          const data = await response.json();
          wsUrl = data.webSocketDebuggerUrl;
          logger.info(`Found WebSocket URL: ${wsUrl}`);
        }
      } catch {
        logger.debug('HTTP endpoint not available, trying fallback');
      }
      
      if (!wsUrl) {
        wsUrl = `ws://${this.host}:${this.port}/devtools/browser/${Date.now()}`;
        logger.info(`Using fallback WebSocket URL: ${wsUrl}`);
      }

      this.browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
        defaultViewport: null
      });

      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
      
      if (!this.page) {
        throw new Error('Failed to get or create page');
      }

      logger.info('Connected to Antigravity IDE via CDP');
    } catch (error) {
      logger.error('Failed to connect to CDP:', error.message, { host: this.host, port: this.port });
      throw error;
    }
  }

  async startMonitoring(callback) {
    const pollInterval = parseInt(process.env.POLL_INTERVAL || '1000', 10);
    
    logger.info(`Starting monitoring with ${pollInterval}ms interval...`);
    
    const poll = async () => {
      try {
        const currentState = await this.checkApprovalState();
        
        if (this.hasStateChanged(currentState)) {
          this.lastState = currentState;
          if (currentState.hasApproval) {
            callback(currentState);
          }
        }
      } catch (error) {
        logger.error('Monitoring error:', error.message);
      }
      
      setTimeout(poll, pollInterval);
    };
    
    poll();
  }

  async checkApprovalState() {
    if (!this.page) {
      logger.debug('Page not initialized, skipping check');
      return { hasApproval: false };
    }
    
    try {
      const approvalInfo = await this.page.evaluate(() => {
        const result = { hasApproval: false, type: '', message: '', buttons: [] };
        
        const approveButtons = document.querySelectorAll('button');
        for (const btn of approveButtons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('approve') || text.includes('confirm') || text.includes('run')) {
            result.hasApproval = true;
            result.type = 'approval';
            result.buttons.push({ text, element: btn.outerHTML });
            break;
          }
        }
        
        return result;
      });
      
      return approvalInfo;
    } catch (error) {
      logger.debug('Error checking approval state:', error.message);
      return { hasApproval: false, error: error.message };
    }
  }

  hasStateChanged(currentState) {
    if (!this.lastState) return currentState.hasApproval;
    return this.lastState.hasApproval !== currentState.hasApproval;
  }

  async clickApprove() {
    logger.info('Clicking approve button...');
    await this.executeButtonAction('approve');
  }

  async clickDeny() {
    logger.info('Clicking deny button...');
    await this.executeButtonAction('deny');
  }

  async executeButtonAction(action) {
    if (!this.page) return;
    
    try {
      await this.page.evaluate((btnAction) => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (btnAction === 'approve' && 
              (text.includes('approve') || text.includes('confirm') || text.includes('run'))) {
            btn.click();
            break;
          } else if (btnAction === 'deny' && 
                     (text.includes('deny') || text.includes('cancel') || text.includes('reject'))) {
            btn.click();
            break;
          }
        }
      }, action);
      
      logger.info(`Successfully clicked ${action} button`);
    } catch (error) {
      logger.error(`Failed to click ${action} button:`, error.message);
    }
  }

  async disconnect() {
    try {
      if (this.browser) {
        await this.browser.disconnect();
        logger.info('Disconnected from CDP');
      }
    } catch (error) {
      logger.error('Error disconnecting from CDP:', error.message);
    }
  }
}
