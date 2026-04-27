const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onSubmissionCreate = onDocumentCreated(
    {
        document: "submissions/{id}",
        region: "us-central1",
    },
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

        // 🔥 NEW UPDATED VALUES (important fix)
        const newTrust = Math.max(
            0,
            Math.min(100, (user.trustScore || 50) + trustDelta)
        );

        const newStreak = user.streakCount || 0;
        const newTotal = user.totalCompletions || 0;

        // 🔥 Badge logic (based on UPDATED values)
        let badges = user.badges || [];

        if (newStreak >= 3 && !badges.includes("3_day_streak")) {
            badges.push("3_day_streak");
        }

        if (newStreak >= 7 && !badges.includes("7_day_streak")) {
            badges.push("7_day_streak");
        }

        if (newTotal >= 5 && !badges.includes("5_completions")) {
            badges.push("5_completions");
        }

        if (newTrust >= 80 && !badges.includes("high_trust")) {
            badges.push("high_trust");
        }

        // 🔥 Update user
        await userRef.update({
            trustScore: newTrust,
            badges
        });

        // 🔥 Update submission
        await ref.update({
            aiScore,
            finalStatus
        });

        console.log("Processed submission:", ref.id);
    }
);