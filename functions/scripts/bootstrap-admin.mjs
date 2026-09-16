import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const emailArg = process.argv.find(value => value.startsWith('--email='));
const projectArg = process.argv.find(value => value.startsWith('--project='));
const databaseArg = process.argv.find(value => value.startsWith('--database='));
const email = emailArg?.slice('--email='.length).trim().toLowerCase();
const projectId = projectArg?.slice('--project='.length).trim();
const databaseId = databaseArg?.slice('--database='.length).trim() || '(default)';

if (!email || !projectId) {
  console.error('Gebruik: npm run bootstrap-admin -- --email=admin@example.com --project=firebase-project-id');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore(databaseId);
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, { role: 'admin', active: true });
await db.collection('users').doc(user.uid).set({
  email,
  name: user.displayName || email.split('@')[0],
  role: 'admin',
  active: true,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
await db.collection('audit_events').add({
  actorId: user.uid,
  action: 'admin.bootstrapped_cli',
  targetType: 'user',
  targetId: user.uid,
  details: {},
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`Beheerder geactiveerd: ${email} (${user.uid})`);
