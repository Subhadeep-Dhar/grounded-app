const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onSubmissionCreate = onDocumentCreated(
  "submissions/{id}",
  async (event) => {
    const data = event.data.data();
    const ref = event.data.ref;

    const userRef = admin.firestore().collection("users").doc(data.userId);
    const userSnap = await userRef.get();
    const user = userSnap.data();

    // 🔥 Trust update
    let trustDelta = 0;
    if (data.status === "approved") trustDelta = +2;
    if (data.status === "flagged") trustDelta = -1;
    if (data.status === "rejected") trustDelta = -3;

    // 🔥 AI scoring
    let aiScore = 0;
    if (data.mediaUrl) aiScore += 40;
    if (data.score >= 70) aiScore += 30;
    aiScore += Math.floor(Math.random() * 30);

    let finalStatus =
      aiScore >= 70 ? "approved" :
      aiScore >= 40 ? "flagged" :
      "rejected";

    // 🔥 Update both user + submission
    await userRef.update({
      trustScore: Math.max(
        0,
        Math.min(100, (user.trustScore || 50) + trustDelta)
      ),
    });

    await ref.update({
      aiScore,
      finalStatus
    });

    console.log("Processed submission:", ref.id);
  }
);