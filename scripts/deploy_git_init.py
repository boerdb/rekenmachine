#!/usr/bin/env python3
"""Eerste keer: git clone op NEXT-server, build, PM2 (poort 3019)."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "192.168.1.32")
USER = os.environ.get("DEPLOY_USER", "root")
# Inloggen met de SSH-sleutel, niet met een wachtwoord.
SSH_KEY_PATH = os.path.expanduser(os.environ.get("SSH_KEY_PATH", "~/.ssh/id_ed25519_homelab"))
SSH_KEY_PASSPHRASE = os.environ.get("SSH_KEY_PASSPHRASE") or None
REMOTE_DIR = os.environ.get("DEPLOY_DIR", "/var/www/rekenmachine")
REPO = os.environ.get(
    "DEPLOY_REPO",
    "git@github.com:boerdb/rekenmachine.git",
)
PORT = int(os.environ.get("DEPLOY_PORT", "3019"))
APP_NAME = os.environ.get("DEPLOY_APP", "rekenmachine")


def run(
    ssh: paramiko.SSHClient,
    cmd: str,
    check: bool = True,
    timeout: int = 600,
) -> tuple[int, str, str]:
    print(f"$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = out.rstrip()
    if text:
        try:
            sys.stdout.buffer.write((text + "\n").encode("utf-8", errors="replace"))
            sys.stdout.flush()
        except Exception:
            print(text.encode("ascii", errors="replace").decode("ascii"))
    if check and code != 0:
        print(err.rstrip().encode("ascii", errors="replace").decode("ascii"), file=sys.stderr)
        raise RuntimeError(f"failed ({code}): {cmd}")
    return code, out, err


def main() -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(
        HOST,
        username=USER,
        key_filename=SSH_KEY_PATH,
        passphrase=SSH_KEY_PASSPHRASE,
        allow_agent=False,
        look_for_keys=False,
        timeout=30,
    )

    run(ssh, "mkdir -p /var/www")
    code, _, _ = run(ssh, f"test -d {REMOTE_DIR}/.git", check=False)
    if code != 0:
        run(ssh, f"rm -rf {REMOTE_DIR}")
        run(ssh, f"git clone {REPO} {REMOTE_DIR}", timeout=300)
    else:
        run(
            ssh,
            f"cd {REMOTE_DIR} && git fetch origin && git checkout main && git reset --hard origin/main",
        )

    run(ssh, f"cd {REMOTE_DIR} && npm ci", timeout=600)
    run(ssh, f"cd {REMOTE_DIR} && npm run build", timeout=600)
    run(ssh, "npm install -g pm2", check=False)
    run(ssh, f"pm2 delete {APP_NAME} 2>/dev/null; true", check=False)
    run(ssh, f"cd {REMOTE_DIR} && pm2 start ecosystem.config.cjs && pm2 save")
    run(ssh, "sleep 3 && pm2 list", check=False)
    run(
        ssh,
        f"curl -s -o /dev/null -w 'HTTP %{{http_code}}\\n' http://127.0.0.1:{PORT}/",
        check=False,
    )

    print("\n=== Git deploy done ===")
    print(f"http://{HOST}:{PORT}  ({REMOTE_DIR})")
    ssh.close()


if __name__ == "__main__":
    main()
