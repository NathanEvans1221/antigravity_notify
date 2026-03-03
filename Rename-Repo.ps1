# ==============================================================================
# 腳本名稱: Rename-Repo.ps1
# 功能描述: 自動化修正專案與 Repository 名稱從舊版到新版 (Windows PowerShell 版)。
# ==============================================================================

Write-Host ">>> 專案名稱修正腳本 (Windows PowerShell)" -ForegroundColor Yellow
Write-Host "功能：將專案中的 antigravity_-notify 修正為 antigravity_notify"
Write-Host ""

$OLD_NAME = "antigravity_-notify"
$NEW_NAME = "antigravity_notify"
$OLD_PKG_NAME = "antigravity-notify"
$NEW_PKG_NAME = "antigravity_notify"

# 1. 修正 package.json 中的名稱
if (Test-Path "package.json") {
    Write-Host "正在修正 package.json..."
    (Get-Content "package.json") -replace "`"name`": `"$OLD_PKG_NAME`"", "`"name`": `"$NEW_PKG_NAME`"" | Set-Content "package.json"
}

# 2. 修正 package-lock.json 中的名稱
if (Test-Path "package-lock.json") {
    Write-Host "正在修正 package-lock.json..."
    (Get-Content "package-lock.json") -replace "`"name`": `"$OLD_PKG_NAME`"", "`"name`": `"$NEW_PKG_NAME`"" | Set-Content "package-lock.json"
}

# 3. 修正 Git Remote URL
$remoteInfo = git remote -v | Select-String "origin" | Select-Object -First 1
if ($remoteInfo -match $OLD_NAME) {
    $currentUrl = ($remoteInfo.ToString() -split "\s+")[1]
    $newUrl = $currentUrl.Replace($OLD_NAME, $NEW_NAME)
    Write-Host "正在修正 Git Remote URL 為: $newUrl"
    git remote set-url origin "$newUrl"
} else {
    Write-Host "Git Remote URL 似乎已經是正確的，跳過。"
}

# 4. 更新或是產生 CHANGELOG 紀錄
if (Test-Path "CHANGELOG.md") {
    $content = Get-Content "CHANGELOG.md" -Raw
    if ($content -notmatch [regex]::Escape($NEW_NAME)) {
        Write-Host "正在更新 CHANGELOG.md..."
        $newEntry = "`n### Changed`n- 自動修正 Repository 名稱與 package 配置為 $NEW_NAME。`n"
        $content = $content -replace "## \[Unreleased\]", "## [Unreleased]`n$newEntry"
        Set-Content "CHANGELOG.md" $content
    }
}

Write-Host ""
Write-Host "✅ 修正完成！" -ForegroundColor Green
Write-Host "建議執行以下指令確認狀態："
Write-Host "1. npm install (更新 lockfile 內容)"
Write-Host "2. git remote -v (確認遠端網址)"
