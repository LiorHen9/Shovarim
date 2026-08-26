cd "c:\Users\liorh\Documents\Shovarim"
npx firebase apphosting:secrets:set firebase-admin-private-key --project shovarim-prod
npx firebase apphosting:secrets:grantaccess firebase-admin-private-key --project shovarim-prod
