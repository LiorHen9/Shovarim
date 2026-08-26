cd "c:\Users\liorh\Documents\Shovarim"
npm run build --prefix functions
npx firebase deploy --only functions --project shovarim-prod
