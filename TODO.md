# TODO List: Antigravity Notify 🚀

本清單反映了基於 **Node.js + CDP** 架構的開發計畫，並與 [PRD.md](PRD.md) 保持一致。

## 🟢 Phase 1: 專案基礎建設 (Project Setup)
- [x] 初始化 Node.js 專案 (`npm init -y`)
- [x] 安裝核心依賴：`puppeteer-core`, `telegraf`, `dotenv`
- [x] 建立 `.env.example` 模板文件
- [x] 實作基本日誌系統 (例如使用 `winston` 或簡單的 `console.log`)

## 🟡 Phase 2: CDP 監控核心 (CDP Monitoring)
- [x] 實作連接 Antigravity CDP 端口的邏輯 (偵錯模式: `--remote-debugging-port=9222`)
- [x] 撰寫 DOM 樹偵測腳本：辨核准按鈕 (Selectors) 與文字變化
- [x] 實作異步輪詢 (Polling) 機制，並進行 Delta 差異化檢查
- [x] 建立事件發射器 (EventEmitter)，用於 UI 變化時觸發通知

## 🔵 Phase 3: Telegram Bot 整合 (Notification & Interaction)
- [x] 建立 Telegram Bot 並取得 Token
- [x] 實作 `/start` 命令與 Chat ID 綁定邏輯
- [x] 撰寫通知訊息模板 (包含 Inline Buttons: ✅ 核准 / ❌ 拒絕)
- [x] 實作 Bot 回調 (Callback Query) 處理程序

## 🔴 Phase 4: 核准操作自動化 (Approval Handler)
- [x] 實作透過 CDP 模擬點擊「Approve」按鈕的邏輯
- [x] 實作「拒絕 / 取消」操作的模擬動作
- [x] 增加操作確認機制：從 Telegram 點擊按鈕後，由 Bot 確認行為已在 IDE 中反映

## 🟣 Phase 5: 資料持久化與優化 (Polish & Persistence)
- [x] 使用 `lowdb` 或 `sqlite` 記錄核准歷史
- [x] 實作斷線重連邏輯 (CDP 端口暫時失效處理)
- [x] 優化 UI Selector：改進解析算法，降低對具體 class 名稱的依賴
- [x] 撰寫 `/history` 指令供使用者查詢

---

## 🛠️ 開發中常見問題筆記
- [x] 監控時是否會因 IDE 的 Tab 切換導致 CDP 失效？
- [x] 確保 Telegram 訊息不會因為頻繁輪詢而重複發送。

## 📅 更新日期
- 2026-03-03: 初始化任務清單。
- 2026-03-03: 完成所有 Phase，實作指令回覆、歷史記錄、單機測試模式。
- 2026-03-03: 防衛性編程優化 - 所有錯誤加入完整 log 追蹤：
  - logger.js: 錯誤物件輸出 message/stack/cause，新增 errorWithContext 方法
  - cdp/client.js: connect() 加入 timeout 及錯誤上下文，disconnect() 加入 try-catch
  - telegram/bot.js: 所有 command/action handler 加入錯誤處理
  - store/history.js: 資料庫初始化失敗時優雅處理，所有 CRUD 操作加入 try-catch
  - index.js: 各階段獨立 try-catch，新增 uncaughtException/unhandledRejection 全域錯誤監聽
