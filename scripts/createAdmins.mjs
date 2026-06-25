import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = "symplfinance-client-portal";

const admins = [
  { email: "tayyab@symplsolutions.com",   uid: "ZRFFli7v1HVarVUPtmsmUNB6WY52" },
  { email: "natasha@symplsolutions.com",  uid: "IodKotAlL3h81LDfwNTl24M7IKn1" },
  { email: "zarah@symplsolutions.com",    uid: "GOn4smp7BqNwd40y4pgQjKHrePx1" },
];

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore"] });
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;

const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`;

for (const { email, uid } of admins) {
  const res = await fetch(`${base}/${uid}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        uid:      { stringValue: uid },
        email:    { stringValue: email },
        role:     { stringValue: "admin" },
        clientId: { nullValue: null },
      },
    }),
  });
  const data = await res.json();
  console.log(res.ok ? `✓ ${email}` : `✗ ${email}: ${JSON.stringify(data.error)}`);
}
