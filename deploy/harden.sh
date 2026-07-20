#!/usr/bin/env bash
# One-time server hardening for a fresh Contabo Ubuntu VPS. Run as root.
#   ssh root@169.58.46.223   then   bash harden.sh <your-ssh-public-key>
set -euo pipefail
PUBKEY="${1:-}"
NEWUSER="deploy"

echo "==> System update"
apt-get update -y && apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades ca-certificates curl gnupg

echo "==> Create sudo user '$NEWUSER'"
id -u "$NEWUSER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$NEWUSER"
usermod -aG sudo "$NEWUSER"
if [ -n "$PUBKEY" ]; then
  install -d -m 700 -o "$NEWUSER" -g "$NEWUSER" "/home/$NEWUSER/.ssh"
  echo "$PUBKEY" > "/home/$NEWUSER/.ssh/authorized_keys"
  chown "$NEWUSER:$NEWUSER" "/home/$NEWUSER/.ssh/authorized_keys"; chmod 600 "/home/$NEWUSER/.ssh/authorized_keys"
else
  echo "!! No SSH key passed — set a password with 'passwd $NEWUSER' before disabling root login."
fi

echo "==> Firewall (SSH + HTTP + HTTPS only)"
ufw default deny incoming; ufw default allow outgoing
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 443/udp
ufw --force enable

echo "==> Harden SSH (key-only, no root login)"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd

echo "==> Enable unattended security upgrades + fail2ban"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now fail2ban

echo "==> Install Docker Engine + Compose plugin"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "$NEWUSER"

echo "==> Done. Log back in as '$NEWUSER' (key-only) and deploy from there."
