# First local setup and GitHub commit

Repository URL:

```bash
https://github.com/heke99/vuqiro.git
```

Target local folder:

```bash
~/Desktop/Projects/vuqiro
```

## 1. Create Projects folder

```bash
mkdir -p ~/Desktop/Projects
cd ~/Desktop/Projects
```

## 2. Clone the empty GitHub repo

```bash
git clone https://github.com/heke99/vuqiro.git
cd vuqiro
```

## 3. Copy/sync the batch files into the repo

If you downloaded `vuqiro-batch1.zip`, unzip it first. Then sync the inner `vuqiro/` folder into the cloned repo.

Example:

```bash
unzip ~/Downloads/vuqiro-batch1.zip -d /tmp/vuqiro-batch1
rsync -av /tmp/vuqiro-batch1/vuqiro/ ~/Desktop/Projects/vuqiro/
```

## 4. Install dependencies

```bash
cd ~/Desktop/Projects/vuqiro
pnpm install
```

If pnpm is missing:

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

## 5. Run mobile app

```bash
pnpm dev:mobile
```

Open the QR code with Expo Go for the Batch 1 mock foundation.

For native IAP/video libraries later, use EAS development builds instead of Expo Go.

## 6. Run admin app

Open a second terminal:

```bash
cd ~/Desktop/Projects/vuqiro
pnpm dev:admin
```

Admin runs on:

```bash
http://localhost:3001
```

## 7. Check code

```bash
pnpm lint
pnpm typecheck
```

## 8. First commit

```bash
git status
git add .
git commit -m "Initial Vuqiro mobile and admin foundation"
```

## 9. Push to GitHub

```bash
git branch -M main
git push -u origin main
```

## 10. Recommended next branch

After first push, create a new branch for the next batch:

```bash
git checkout -b cursor/vuqiro-backend-foundation
```
