[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$content = Get-Content 'C:\Users\Yassine\OneDrive\Bureau\ai studio\CLAUDE.md' -Raw -Encoding UTF8
$obj = @{
    hookSpecificOutput = @{
        hookEventName = 'UserPromptSubmit'
        additionalContext = "=== CLAUDE.md RULES (MANDATORY) ===`n$content`n=== END RULES ==="
    }
}
Write-Output ($obj | ConvertTo-Json -Depth 5 -Compress)
