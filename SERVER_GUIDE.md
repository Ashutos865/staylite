# StayLite EC2 Server Guide

## Instance Info
- **Instance:** staylite-backend (t3.micro, ap-south-1a Mumbai)
- **IP:** 15.207.233.76
- **Cost:** ~₹900/month (t3.micro is NOT in free tier — t2.micro not available in this AZ)
- **RAM:** 1GB | **vCPU:** 2 | **Storage:** 8GB EBS

## PEM Key Location
```
C:\Users\ashut\Downloads\staylite-key.pem
```

## SSH Into Server
```powershell
ssh -i "C:\Users\ashut\Downloads\staylite-key.pem" ubuntu@15.207.233.76
```

> If SSH times out: AWS Console → EC2 → Security Group → Edit inbound rules → Add SSH rule → Source: My IP

> Alternative (no PEM needed): AWS Console → EC2 → Instances → Connect → EC2 Instance Connect → Connect

---

## ⚠️ Important Warnings

### Restart Server button in Developer Portal
- Only works in production with PM2
- **Locally it KILLS the server** — you must restart manually with `npm run dev`

### IP address after reboot
- If no Elastic IP is attached, the public IP changes after every stop/start
- If IP changes, update `vercel.json` with the new IP and redeploy Vercel

---

## After SSH — Common Commands

### Check if backend is running
```bash
pm2 list
```
Should show `staylite-api` with status `online`.

### Restart backend (code unchanged)
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

### If new packages were added (502 errors after pull)
```bash
cd ~/staylite/backend
npm install
pm2 restart all
```

### View live backend logs
```bash
pm2 logs staylite-api
```

### View last 100 log lines
```bash
pm2 logs staylite-api --lines 100
```

---

## Add Swap Memory (run once — prevents crashes)
Gives 1GB extra virtual RAM for free:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
Verify with: `free -h` — should show 1GB swap

---

## Auto-start on EC2 Reboot (run once)
```bash
pm2 startup
# copy-paste the command it prints, then:
pm2 save
```
After this, PM2 restarts automatically if EC2 reboots.

---

## Error Conditions & Fixes

| What you see | Meaning | Fix |
|---|---|---|
| **502 Bad Gateway** | Backend is down / crashed | `pm2 restart all` or `npm install && pm2 restart all` |
| **404 Not Found** (on API routes) | Backend running old code | `git stash && git pull origin main && pm2 restart all` |
| **401 Unauthorized** | Backend running, session expired | Log out and log back in |
| **500 Internal Server Error** | Backend crashed on that request | `pm2 logs staylite-api` to see the error |
| **git pull fails** (local changes) | EC2 has modified files | `git stash` then `git pull origin main` |
| **SSH: Connection timed out** | Port 22 blocked in Security Group | AWS Console → EC2 → Security Group → Add SSH My IP |
| **pm2 not found** | PM2 not installed | `npm install -g pm2` |
| **"Request failed"** in Dev Portal | Clicked Restart button locally | Run `npm run dev` in backend folder |

---

## First Time PM2 Setup (if pm2 not running)
```bash
cd ~/staylite/backend
npm install
pm2 start server.js --name staylite-api
pm2 save
pm2 startup
# run the command it prints
```

---

## Full Deploy Checklist (after pushing code changes)
1. `git push origin main` — from local machine
2. SSH into EC2
3. `cd ~/staylite`
4. `git stash` (clears any local EC2 changes)
5. `git pull origin main`
6. `cd backend && npm install` — only if `package.json` changed
7. `cd ~/staylite && pm2 restart all`
8. `pm2 logs staylite-api` — check for crash errors
