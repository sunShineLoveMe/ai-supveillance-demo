# 排查 GitHub "Binary files are not supported" 报错

当你在 GitHub Pull Request 页面点击 **Update branch** 或尝试在线解决冲突时，如果冲突文件被判定为二进制文件，GitHub 会提示 `Binary files are not supported` 并阻止继续操作。常见触发原因有：

- 分支中曾经添加/删除过图片、视频或其它二进制文件；
- 锁文件（如 `pnpm-lock.yaml`）过大，GitHub 误判为二进制；
- 分支与主干同时修改了相同的图片或资产文件，导致无法在网页上展示冲突 diff。

可以使用以下方法在本地处理冲突，然后再 push：

1. **拉取最新的主干代码**
   ```bash
   git fetch origin
   ```
2. **切换到你的工作分支**（如果还没在分支上）
   ```bash
   git checkout <your-branch>
   ```
3. **合并或变基主干**（任选其一）：
   ```bash
   # 方式 A：合并
   git merge origin/main

   # 方式 B：变基
   git rebase origin/main
   ```
4. 如果 Git 显示某些二进制文件存在冲突，使用 `--ours` 或 `--theirs` 来选择保留哪一版，例如：
   ```bash
   git checkout --ours public/placeholder.jpg      # 保留当前分支版本
   git checkout --theirs public/placeholder.jpg   # 保留主干版本
   ```
   对于锁文件，可考虑重新运行安装命令生成一致的版本：
   ```bash
   pnpm install
   ```
5. 冲突解决后，检查状态并完成提交：
   ```bash
   git status
   git add <resolved-files>
   git commit
   ```
6. 最后将更新推送到远程分支，再次在 GitHub 上刷新 PR 页面即可：
   ```bash
   git push
   ```

> 如果分支历史中包含了不再需要的二进制文件，可以使用 `git rebase -i` 或 `git filter-repo` 等高级命令清理历史，然后重新强推 (`git push --force-with-lease`)。执行前请务必与团队沟通，避免覆盖他人提交。

通过本地处理，可以绕过 GitHub 网页端无法展示二进制 diff 的限制，顺利更新分支。
