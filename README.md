# Card Ledger

A shared Clash of Cards trading board for your clan. Static site, no build step —
Firebase Realtime Database handles the shared data (who has extras, who needs what),
GitHub Pages hosts the files.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com and click **Add project**. Any name is fine.
2. You can skip Google Analytics when prompted — not needed here.
3. Once the project loads, in the left sidebar go to **Build → Realtime Database → Create Database**.
   Pick any region, and start in **test mode** (open read/write) — that's what lets every
   clan member's browser read and write without a login system.
4. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** → click the
   `</>` (web) icon → register the app (any nickname) → it shows you a `firebaseConfig` object.
5. Copy that object into `firebase-config.js` in this folder, replacing the `PASTE_ME` placeholders.

Test mode leaves the database open to anyone with the URL — fine for a small trusted clan,
but don't post the Firebase config anywhere public beyond your clan.

## 2. Put these files on GitHub

1. Create a new GitHub repo (public or private — public is required for the free GitHub Pages tier
   unless you're on GitHub Pro/Team).
2. Upload all the files in this folder (`index.html`, `style.css`, `app.js`, `firebase-config.js`)
   to the repo root — or `git push` them if you're comfortable with git.
3. In the repo, go to **Settings → Pages**. Under **Build and deployment**, set **Source** to
   "Deploy from a branch," pick your main branch and `/ (root)`, and save.
4. GitHub gives you a URL like `https://yourname.github.io/repo-name/` — that's your clan's
   permanent link. Share that, not the raw file.

## 3. Add card images from GitHub

Since you're hosting on GitHub already, the easiest image path:

1. Add an `images/` folder to the same repo, drop your troop images in.
2. For each image, get its **raw** URL — click the file in GitHub, click **Raw**, copy that URL
   (looks like `https://raw.githubusercontent.com/yourname/repo-name/main/images/dragon.png`).
3. On the live site, click any card's image box and paste that URL in.

Raw GitHub URLs work fine for a small clan tool. If you want faster/cached loading later,
GitHub Pages itself also serves the images (`https://yourname.github.io/repo-name/images/dragon.png`)
once the repo is deployed — either URL works.

## 4. Using it day to day

- Each member opens the link once and types their in-game name (remembered after that, per device).
- Tap "Have extra" / "Need it" on cards after raids — saves automatically.
- The **Trade Matches** tab shows every live pairing across the clan.
- Trades themselves still happen in-game — this just tells you who to message.

## Notes

- No login system — anyone with the link can edit anything. That's a deliberate simplicity
  tradeoff for a small trusted clan, not an oversight.
- Firebase's free "Spark" plan covers this comfortably for a normal-sized clan's usage.