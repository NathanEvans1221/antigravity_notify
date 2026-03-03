import readline from 'readline';
import { MockTelegramBot } from './telegram/mockBot.js';

class TestRunner {
  constructor() {
    this.mockBot = new MockTelegramBot();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n🧪 Antigravity Notify 測試模式\n');
    await this.mockBot.start();

    await this.simulateApprovalRequest();

    this.showHelp();
    this.prompt();
  }

  async simulateApprovalRequest() {
    const mockEvents = [
      { type: '代碼審查', message: '是否核准此代碼變更？' },
      { type: '執行終端命令', message: 'rm -rf /tmp/test' },
      { type: '敏感權限', message: '請求存取系統管理員權限' }
    ];

    const event = mockEvents[Math.floor(Math.random() * mockEvents.length)];
    
    await this.mockBot.sendApprovalRequest(event, (action) => {
      console.log(`\n📝 動作已執行: ${action}\n`);
    });
  }

  showHelp() {
    console.log('\n可用指令:');
    console.log('  approve / yes / ok   - 核准');
    console.log('  deny / no / reject  - 拒絕');
    console.log('  history             - 查看歷史');
    console.log('  trigger             - 觸發新請求');
    console.log('  help                - 顯示說明');
    console.log('  quit                - 離開');
  }

  prompt() {
    this.rl.question('\n> ', async (input) => {
      const cmd = input.trim().toLowerCase();

      switch (cmd) {
        case 'approve':
        case 'yes':
        case 'ok':
        case 'y':
        case '好':
        case '確認':
        case '同意':
          await this.mockBot.handleInput(cmd);
          break;
        case 'deny':
        case 'no':
        case 'reject':
        case 'n':
        case '不要':
        case '拒絕':
        case '不同意':
          await this.mockBot.handleInput(cmd);
          break;
        case 'history':
          await this.mockBot.showHistory();
          break;
        case 'trigger':
          await this.simulateApprovalRequest();
          break;
        case 'help':
          this.showHelp();
          break;
        case 'quit':
        case 'exit':
          await this.mockBot.stop();
          this.rl.close();
          console.log('👋 測試結束');
          process.exit(0);
          return;
        default:
          if (cmd) console.log(`⚠️ 未知指令: ${cmd}`);
      }

      this.prompt();
    });
  }
}

const runner = new TestRunner();
runner.start().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
