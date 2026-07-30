# Rekenmachine deployen (Next + PM2)

Zelfde aanpak als Scheikunde Lab / Reactievergelijking.

## Architectuur

- **Next.js** op server **NEXT** (`192.168.1.32`) → `/var/www/rekenmachine` → poort **3019**
- **PM2** procesnaam: `rekenmachine`
- GitHub: `git@github.com:boerdb/rekenmachine.git` (branch `main`)
- Geen database nodig

```
Telefoon/LAN → http://192.168.1.32:3019 → Next.js
```

## Eerste installatie

Vanaf je PC:

```bash
python scripts/deploy_git_init.py
```

Of handmatig op de server:

```bash
cd /var/www
git clone git@github.com:boerdb/rekenmachine.git rekenmachine
cd rekenmachine
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

## Updates

```bash
python scripts/deploy_pull.py
```

Of op de server:

```bash
cd /var/www/rekenmachine
git pull
npm ci
npm run build
pm2 restart rekenmachine --update-env
```

## Controle

```bash
pm2 list | grep rekenmachine
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3019/
```

App: http://192.168.1.32:3019
