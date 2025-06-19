const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();
const messaging = admin.messaging();

exports.sendClassroomIssueNotification = functions.database // Corrected line: Removed the extra '.database' here
    .ref("/notificationTriggers/newClassroomIssue/{pushId}")
    .onValueCreated(async (snapshot, context) => {
      const issueData = snapshot.val();
      const {building, classroom, summary} = issueData;

      const adminTokensSnapshot = await db.ref("fcmTokens/admin")
          .once("value");
      const supportTokensSnapshot = await db.ref("fcmTokens/support")
          .once("value");

      const tokens = [];
      if (adminTokensSnapshot.exists()) {
        adminTokensSnapshot.forEach((child) =>
          tokens.push(child.val().token),
        );
      }
      if (supportTokensSnapshot.exists()) {
        supportTokensSnapshot.forEach(
            (child) => tokens.push(child.val().token),
        );
      }

      if (tokens.length === 0) {
        console.log(
            "No admin/support tokens found to send notification.",
        );
        return null;
      }

      const payload = {
        notification: {
          title: "New Classroom Issue Reported!",
          body: `Building: ${building}, Classroom: ${classroom} - ` +
                      `Issue: ${summary}`,
          icon: "/pics/lau_icon.png",
        },
        data: {
          url: `/beirut_classrooms.html?building=${building}&` +
                     `level=Level ${issueData.level || ""}&room=${classroom}`,
          type: "new-classroom-issue",
        },
      };

      try {
        const response = await messaging.sendToMultiple(tokens, payload);
        console.log("Successfully sent classroom issue message:", response);
        // Remove the trigger data after processing
        return snapshot.ref.remove();
      } catch (error) {
        console.error("Error sending classroom issue message:", error);
        return null;
      }
    });