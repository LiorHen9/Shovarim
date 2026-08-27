cd "c:\Users\liorh\Documents\Shovarim"
npx firebase apphosting:secrets:set card-field-encryption-key --project shovarim-prod
npx firebase apphosting:secrets:grantaccess card-field-encryption-key --project shovarim-prod
