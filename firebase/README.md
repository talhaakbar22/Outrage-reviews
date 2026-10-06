# Do not deploy these rules from this repo

`firebase/firestore.reviews.rules` and `firebase/storage.reviews.rules` are
**fragments** owned by Outrage Reviews.

The live Firebase project `outrageldn-dashboard` is shared with
`outragelondondashboard`. Deploying rules from here would replace the dashboard
rules and break the main app.

- Merge reviews rules into `outragelondondashboard/firestore.rules` (already done for Phase 2).
- Deploy rules only from the dashboard repo: `firebase deploy --only firestore:rules`
- From this repo, deploy **functions only**: `yarn firebase:deploy:functions`
