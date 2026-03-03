#!/bin/bash
# ==============================================================================
# 腳本名稱: rename_repo.sh
# 功能描述: 自動化修正專案與 Repository 名稱從舊版到新版。
# ==============================================================================

echo -e "\033[1;33m>>> 專案名稱修正腳本\033[0m"
echo -e "\033[0;37m功能：將專案中的 antigravity_-notify 修正為 antigravity_notify\033[0m"
echo ""

OLD_NAME="antigravity_-notify"
NEW_NAME="antigravity_notify"
OLD_PKG_NAME="antigravity-notify"
NEW_PKG_NAME="antigravity_notify"

# 1. 修正 package.json 中的名稱
if [ -f "package.json" ]; then
    echo "正在修正 package.json..."
    sed -i '' "s/\"name\": \"$OLD_PKG_NAME\"/\"name\": \"$NEW_PKG_NAME\"/g" package.json
    sed -i '' "s/\"name\": \"$OLD_NAME\"/\"name\": \"$NEW_NAME\"/g" package.json
fi

# 2. 修正 package-lock.json 中的名稱
if [ -f "package-lock.json" ]; then
    echo "正在修正 package-lock.json..."
    sed -i '' "s/\"name\": \"$OLD_PKG_NAME\"/\"name\": \"$NEW_PKG_NAME\"/g" package-lock.json
    sed -i '' "s/\"name\": \"$OLD_NAME\"/\"name\": \"$NEW_NAME\"/g" package-lock.json
fi

# 3. 修正 Git Remote URL
CURRENT_REMOTE=$(git remote -v | grep origin | head -n 1)
if [[ $CURRENT_REMOTE == *"$OLD_NAME"* ]]; then
    NEW_REMOTE=${CURRENT_REMOTE//$OLD_NAME/$NEW_NAME}
    NEW_URL=$(echo $NEW_REMOTE | awk '{print $2}')
    echo "正在修正 Git Remote URL 為: $NEW_URL"
    git remote set-url origin "$NEW_URL"
else
    echo "Git Remote URL 似乎已經是正確的，跳過。"
fi

# 4. 更新或是產生 CHANGELOG 紀錄
if [ -f "CHANGELOG.md" ]; then
    if ! grep -q "$NEW_NAME" CHANGELOG.md; then
        echo "正在更新 CHANGELOG.md..."
        # 這邊簡單插入一筆紀錄在 Unreleased 下面
        sed -i '' "/## \[Unreleased\]/a\\
\\
### Changed\\
- 自動修正 Repository 名稱與 package 配置為 $NEW_NAME。
" CHANGELOG.md
    fi
fi

echo ""
echo -e "\033[1;32m✅ 修正完成！\033[0m"
echo "建議執行以下指令確認狀態："
echo "1. npm install (更新 lockfile 內容)"
echo "2. git remote -v (確認遠端網址)"
