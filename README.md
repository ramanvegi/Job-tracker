# Job Search Command Center

A job application tracker that syncs across every device you sign into. New entries always
go to the top of the log — you never scroll to add data. Daily, Weekly, and Monthly views,
plus an overall summary, are calculated automatically from your log. Export to Excel anytime.

This is a real, deployable web app: **React + Vite** for the frontend, **Firebase** (free tier)
for sign-in and data storage, hosted for free on **Vercel**.

Total cost: **$0**, no credit card required anywhere in this setup.

---

## Part 1 — Create your free Firebase project (~3 minutes)

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Add project** → give it any name (e.g. `job-tracker`) → you can turn off Google
   Analytics (not needed) → **Create project**.
3. Once it's created, click the **Web** icon (`</>`) to register a web app. Give it a nickname
   (e.g. `web`) and click **Register app**. You do **not** need Firebase Hosting.
4. You'll see a code block with a `firebaseConfig` object containing values like `apiKey`,
   `authDomain`, `projectId`, etc. **Keep this tab open** — you'll copy these values in Part 3.

### Enable sign-in
5. In the left sidebar, go to **Build → Authentication** → **Get started**.
6. Under **Sign-in method**, click **Email/Password**, toggle it **on**, and **Save**.

### Create the database
7. In the left sidebar, go to **Build → Firestore Database** → **Create database**.
8. Choose a location close to you, and start in **Production mode** → **Create**.
9. Once created, go to the **Rules** tab and replace the contents with what's in
   `firestore.rules` in this project (also pasted below), then click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   This ensures each signed-in user can only ever read or write their own data.

---

## Part 2 — Run it locally (optional, to test before deploying)

You'll need [Node.js](https://nodejs.org) installed (any recent version).

```bash
cd job-tracker
npm install
cp .env.example .env
```

Open `.env` and paste in the values from your `firebaseConfig` (Part 1, step 4):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=job-tracker-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=job-tracker-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=job-tracker-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Then run:

```bash
npm run dev
```

Open the printed `localhost` URL, create an account (any email/password), and try adding a
few applications.

---

## Part 3 — Deploy to Vercel (free, ~5 minutes)

1. Push this project to a **GitHub repository** (create one at github.com/new, then follow
   its instructions to push this folder — or use GitHub Desktop if you prefer a UI).
2. Go to https://vercel.com, sign up/sign in with your GitHub account (free, no card needed).
3. Click **Add New → Project**, select your repository, and click **Import**.
4. Vercel auto-detects Vite — leave the build settings as default.
5. Before deploying, open **Environment Variables** and add the same six `VITE_FIREBASE_*`
   values from your `.env` file (Part 2).
6. Click **Deploy**. In about a minute you'll get a live URL like
   `https://job-tracker-yourname.vercel.app` — open it on your phone and laptop, sign in with
   the same account on both, and your data will sync between them.

Every time you push a change to GitHub, Vercel redeploys automatically.

---

## How data storage works

- Each signed-in user's applications live in Firestore at `users/{your-uid}/applications/*`.
- Your daily Manual target lives at `users/{your-uid}/settings/targets`.
- Data updates in real time — add an application on your phone, and it appears instantly on
  your laptop if both are open.
- Firebase's free Spark plan covers this comfortably: 50,000 reads and 20,000 writes per day,
  1 GiB stored — far more than a personal job search will ever use.

## Notes

- If you ever forget your password, use "Forgot password?" on the sign-in screen — Firebase
  emails you a reset link.
- To let a second person sign in (e.g. if you want to share access), they'd need a separate
  Firebase account — this app is built as single-user-per-account, not shared/team data.
