# My solutions

How I solved each level and **why it works**. 🇪🇸 [En español](EXERCISES.es.md)

---

### 1. Commits: save points
```
git commit -m "Add homepage"
git commit -m "Add contact form"
```
Each commit is a snapshot that points back to the one before it. `main` moves forward to the newest commit every time, because HEAD is attached to `main`.

### 2. Branches: parallel worlds
```
git switch -c new-feature
git commit
```
`switch -c` creates the branch **and** moves HEAD onto it. That is why the next commit moves `new-feature`, while `main` stays where it was.

### 3. Merge: bring work together
```
git merge bugfix
```
I'm already on `main` (the branch that receives the work). Both branches have commits the other one doesn't, so Git can't just slide `main` forward. It creates a merge commit with two parents.

### 4. Rebase: a straight line
```
git switch feature
git rebase main
```
Rebase copies my commits (C2, C3 → C2', C3') on top of the latest `main`. The originals fade because no branch points to them anymore. I only rebase my own branch, never commits other people already have.

### 5. HEAD: where you stand
```
git checkout C1
```
Checking out a commit (not a branch) detaches HEAD. Good for looking at the past. If I wanted to keep new work from there, I would create a branch first.

### 6. Relative refs: ~ and ^
```
git branch review main~2
git checkout main^
```
`main~2` = two steps back from `main` (C2). `main^` = the parent of `main` (C3). Faster and safer than copying commit ids.

### 7. Undo: reset vs revert
```
git switch local
git reset HEAD~1
git switch shared
git revert HEAD
```
`local` is private, so I can rewrite it: `reset` moves the branch back one commit. `shared` was already pushed, so I don't rewrite it: `revert` adds a new commit that cancels the bad one.

### 8. Cherry-pick: choose commits
```
git cherry-pick C2 C4
```
I only want the two fixes, not the weird test (C3). A merge would bring all three; cherry-pick copies just the ones I name.

### 9. Tags: mark versions
```
git tag v1.0 C1
git tag v2.0
```
Tags never move, unlike branches. Without a target, a tag goes on HEAD.

### 10. Final challenge: a real workflow
```
git switch -c feature/login
git commit -m "Login form"
git commit -m "Login validation"
git switch main
git merge --no-ff feature/login
git tag v1.0
```
`main` didn't move, so a normal merge would just fast-forward. `--no-ff` forces a merge commit, so the history shows the feature as one unit. Then I tag the release. **This is exactly how this repository was built**: one branch and one pull request per feature, merged into `main`, tagged `v1.0.0`.
