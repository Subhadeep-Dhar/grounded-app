import * as admin from "firebase-admin";

// Ensure admin is initialized. In Firebase Functions this is typically done
// in the root index.js. This ensures we can safely use the db instance here.
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
