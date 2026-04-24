#!/usr/bin/env bash
# One-shot setup to push PomeloSMP into THIRASAN1/pomelo-smp from inside a GitHub Codespace.
# Usage (inside Codespace terminal, after dragging pomelo-smp.zip into workspace):
#   unzip -o pomelo-smp.zip && bash scripts/codespace-setup.sh
set -euo pipefail

REMOTE_SSH="git@github.com:THIRASAN1/pomelo-smp.git"
REMOTE_HTTPS="https://github.com/THIRASAN1/pomelo-smp.git"
BRANCH="main"
COMMIT_MSG="feat: initial PomeloSMP site"

log() { printf "\033[36m▶ %s\033[0m\n" "$*"; }
ok()  { printf "\033[32m✔ %s\033[0m\n" "$*"; }

# 1) init repo if needed
if [ ! -d .git ]; then
  log "git init"
  git init -q
fi

# 2) configure identity (required for commit)
if ! git config user.email >/dev/null 2>&1; then
  EMAIL="$(gh api user --jq .email 2>/dev/null || true)"
  if [ -z "${EMAIL}" ] || [ "${EMAIL}" = "null" ]; then
    UID_NUM="$(gh api user --jq .id 2>/dev/null || echo 000)"
    LOGIN="$(gh api user --jq .login 2>/dev/null || echo THIRASAN1)"
    EMAIL="${UID_NUM}+${LOGIN}@users.noreply.github.com"
  fi
  git config user.email "${EMAIL}"
  ok "user.email=${EMAIL}"
fi
if ! git config user.name >/dev/null 2>&1; then
  NAME="$(gh api user --jq .login 2>/dev/null || echo THIRASAN1)"
  git config user.name "${NAME}"
  ok "user.name=${NAME}"
fi

# 3) ensure remote origin points at the target repo (SSH first)
if git remote | grep -q '^origin$'; then
  git remote set-url origin "${REMOTE_SSH}"
else
  git remote add origin "${REMOTE_SSH}"
fi
ok "remote origin → ${REMOTE_SSH}"

# 3b) create the repo on GitHub if it doesn't exist yet
if command -v gh >/dev/null 2>&1; then
  if ! gh repo view THIRASAN1/pomelo-smp >/dev/null 2>&1; then
    log "remote repo not found → creating public repo THIRASAN1/pomelo-smp"
    gh repo create THIRASAN1/pomelo-smp --public --disable-wiki >/dev/null
    ok "repo created"
  else
    ok "repo exists on GitHub"
  fi
fi

# 4) branch main
git checkout -B "${BRANCH}" >/dev/null 2>&1 || git branch -M "${BRANCH}"

# 5) stage + commit
log "staging files"
git add .
if git diff --cached --quiet; then
  ok "nothing new to commit"
else
  git commit -q -m "${COMMIT_MSG}"
  ok "commit created"
fi

# 6) push — try SSH, fall back to HTTPS if SSH isn't configured in this Codespace
log "pushing to ${REMOTE_SSH}"
if git push -u origin "${BRANCH}"; then
  ok "pushed via SSH"
else
  echo
  log "SSH push failed — retrying via HTTPS"
  git remote set-url origin "${REMOTE_HTTPS}"
  git push -u origin "${BRANCH}"
  ok "pushed via HTTPS (remote switched to ${REMOTE_HTTPS})"
fi

echo
ok "Done! Repo → https://github.com/THIRASAN1/pomelo-smp"
