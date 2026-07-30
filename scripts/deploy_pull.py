#!/usr/bin/env python3
"""Update op server via git pull + build + PM2 restart."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "192.168.1.32")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "kerkpoort")
REMOTE_DIR = os.environ.get("DEPLOY_DIR", "/var/www/rekenmachine")
PORT = int(os.environ.get("DEPLOY_PORT", "3019"))
APP_NAME = os.environ.get("DEPLOY_APP", "rekenmachine")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> None:
    print(f"$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = out.rstrip()
    if text:
        sys.stdout.buffer.write((text + "\n").encode("utf-8", errors="replace"))
        sys.stdout.flush()
    if code != 0:
        sys.stderr.buffer.write((err.rstrip() + "\n").encode("utf-8", errors="replace"))
        raise RuntimeError(f"failed ({code}): {cmd}")


def main() -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    run(ssh, f"cd {REMOTE_DIR} && git pull")
    run(ssh, f"cd {REMOTE_DIR} && npm ci")
    run(ssh, f"cd {REMOTE_DIR} && npm run build")
    run(ssh, f"pm2 restart {APP_NAME} --update-env")
    run(
        ssh,
        f"sleep 2 && curl -s -o /dev/null -w '%{{http_code}}\\n' http://127.0.0.1:{PORT}/",
    )
    ssh.close()
    print("Pull deploy OK")


if __name__ == "__main__":
    main()
