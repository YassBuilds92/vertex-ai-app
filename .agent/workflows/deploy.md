---
description: Pull remote changes and push local edits to GitHub to trigger deployment.
---

// turbo-all

1. Pull remote changes to sync with current state.
```powershell
git pull origin main --rebase
```

2. Add all modified files.
```powershell
git add .
```

3. Commit changes with a descriptive message.
```powershell
git commit -m "Auto-update by AI assistant"
```

4. Push to remote repository.
```powershell
git push origin main
```
