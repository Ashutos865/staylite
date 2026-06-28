# StayLite EC2 Server Guide

## Instance Info
- **Instance:** staylite-backend (t3.micro, ap-south-1a Mumbai)
- **Permanent IP:** 15.207.233.76 (Elastic IP — never changes)
- **Cost:** ~₹900/month (t3.micro)
- **RAM:** 1GB + 1GB Swap | **vCPU:** 2 | **Storage:** 14GB EBS

## PEM Key Location
```
C:\Users\ashut\Downloads\staylite-key.pem
```

---

## What is SSH?
SSH (Secure Shell) is how you remotely control your EC2 server from your laptop.
Think of it like TeamViewer but for the terminal — you type commands on your laptop
and they run on the server in Mumbai.

---

## How to Connect to EC2

### Option 1 — SSH from your laptop (PowerShell)
```powershell
ssh -i "C:\Users\ashut\Downloads\staylite-key.pem" ubuntu@15.207.233.76
```
If it says "Connection timed out":
- AWS Console → EC2 → Instances → click instance → Security tab → Security Group
- Edit inbound rules → Add rule → Type: SSH, Source: My IP → Save

### Option 2 — Browser terminal (easiest, no PEM needed)
1. AWS Console → EC2 → Instances
2. Select `staylite-backend` → click **Connect**
3. **EC2 Instance Connect** tab → click **Connect**
4. Terminal opens in browser — done

---

## After Connecting — Most Used Commands

### Check if backend is running
```bash
pm2 list
```
Should show `staylite-api` with status `online`.

### See live logs (what's happening right now)
```bash
pm2 logs staylite-api --lines 30
```
Press `Ctrl+C` to exit logs.

### Restart backend
```bash
pm2 restart all
```

### Update code from GitHub + restart
```bash
cd ~/staylite
git stash
git pull origin main
pm2 restart all
```

### If new packages were added (after npm install errors or 502)
```bash
cd ~/staylite/backend
npm install
cd ~/staylite
pm2 restart all
```

---

## Add Missing .env Variables on EC2
The `.env` file is NOT synced from GitHub (for security).
If you add new env variables locally, you must add them to EC2 manually.

### Add VAPID keys (Web Push — run once)
```bash
echo 'VAPID_PUBLIC_KEY=BBKUW5M8lcqxkhxXQznPz3KXhhbc-4pe3yCdQypvAOJzI24eL36uTBQ0Knnu7Z6yMiZRAj1_XPnatWymsoDYTjs' >> ~/staylite/backend/.env
echo 'VAPID_PRIVATE_KEY=595Zu7kskipy510m1OP6HJI5HjU3Ex30F6rfmT_F7Ho' >> ~/staylite/backend/.env
echo 'VAPID_MAILTO=mailto:techties.ai@gmail.com' >> ~/staylite/backend/.env
pm2 restart all
```

### View current .env file
```bash
cat ~/staylite/backend/.env
```

### Edit .env file
```bash
nano ~/staylite/backend/.env
```
- Use arrow keys to move
- Make changes
- Press `Ctrl+X` → `Y` → Enter to save

---

## Add Swap Memory (run once — prevents crashes)
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
Verify: `free -h` — should show 1GB swap

---

## PM2 Auto-start on Reboot (run once)
```bash
pm2 startup
# Copy and run the command it prints, then:
pm2 save
```

---

## Error Conditions & Fixes

| What you see | Meaning | Fix |
|---|---|---|
| **502 Bad Gateway** | Backend crashed / not running | `pm2 restart all` — if still 502, check `pm2 logs staylite-api --lines 30` |
| **404 Not Found** on API routes | Backend running old code | `cd ~/staylite && git stash && git pull origin main && pm2 restart all` |
| **401 Unauthorized** | Session expired | Log out and log back in |
| **500 Internal Server Error** | Backend crashed on that request | `pm2 logs staylite-api --lines 30` to see the error |
| **SSH: Connection timed out** | Port 22 blocked | AWS → EC2 → Security Group → Add SSH inbound rule → My IP |
| **"No key set vapidDetails"** | VAPID keys missing from EC2 .env | Run the VAPID echo commands above, then `pm2 restart all` |
| **git pull fails** (local changes) | EC2 has modified files | `git stash` then `git pull origin main` |
| **"Request failed"** in Dev Portal | Clicked Restart button locally | Run `npm run dev` in backend folder on your laptop |
| **IP changed after restart** | No Elastic IP (now fixed) | Already fixed — Elastic IP 15.207.233.76 is permanent |

---

## Full Deploy Checklist (every time you push code changes)
1. Push from laptop: `git push origin main`
2. Connect to EC2 (SSH or browser)
3. `cd ~/staylite`
4. `git stash`
5. `git pull origin main`
6. `cd backend && npm install` ← only if `package.json` changed
7. `cd ~/staylite && pm2 restart all`
8. `pm2 logs staylite-api --lines 20` ← check for errors

---

## What Each Command Does

| Command | What it does |
|---|---|
| `pm2 list` | Shows all running Node.js processes and their status |
| `pm2 restart all` | Restarts all Node.js processes managed by PM2 |
| `pm2 logs staylite-api --lines 30` | Shows last 30 lines of server logs |
| `pm2 save` | Saves current process list so PM2 restores them after reboot |
| `git stash` | Temporarily saves any local changes on EC2 (clears conflicts) |
| `git pull origin main` | Downloads latest code from GitHub |
| `npm install` | Installs any new packages added to package.json |
| `cat file.txt` | Shows contents of a file |
| `nano file.txt` | Opens a file for editing (Ctrl+X to exit) |
| `free -h` | Shows RAM and swap memory usage |
| `df -h` | Shows disk space usage |

---

## ⚠️ Important Warnings
- **Restart Server button** in Dev Portal only works with PM2 on EC2. Locally it KILLS the server — restart with `npm run dev`
- **Never stop EC2 instance** without noting that Elastic IP is now attached (stays fixed)
- **Elastic IP costs money** if instance is stopped but IP is still allocated (~$0.005/hr) — either keep instance running or release the IP when not using
- **.env file** is not in GitHub — if you add new env variables locally, add them to EC2 manually too
