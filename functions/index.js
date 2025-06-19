const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();
const messaging = admin.messaging();

// Function to send notifications to admins/support for new classroom issues
exports.sendClassroomIssueNotification = functions.database.ref("/notificationTriggers/newClassroomIssue/{pushId}")
    .onCreate(async (snapshot, context) => {
      const issueData = snapshot.val();
      const {building, classroom, summary} = issueData;

      // Fetch all admin and support tokens
      const adminTokensSnapshot = await db.ref("fcmTokens/admin").once("value");
      const supportTokensSnapshot = await db.ref("fcmTokens/support").once("value");

      const tokens = [];
      if (adminTokensSnapshot.exists()) {
        adminTokensSnapshot.forEach((child) => tokens.push(child.val().token));
      }
      if (supportTokensSnapshot.exists()) {
        supportTokensSnapshot.forEach((child) => tokens.push(child.val().token));
      }

      if (tokens.length === 0) {
        console.log("No admin/support tokens found to send notification.");
        return null;
      }

      const payload = {
        notification: {
          title: "New Classroom Issue Reported!",
          body: `Building: ${building}, Classroom: ${classroom} - Issue: ${summary}`,
          icon: "/pics/lau_icon.png",
        },
        data: {
          url: `/beirut_classrooms.html?building=${building}&level=Level <span class="math-inline">\{issueData\.level \|\| ''\}&room\=</span>{classroom}`,
          type: "new-classroom-issue",
        },
      };

      try {
        const response = await messaging.sendToMultiple(tokens, payload);
        console.log("Successfully sent classroom issue message:", response);
        // Delete the trigger after processing
        return snapshot.ref.remove();
      } catch (error) {
        console.error("Error sending classroom issue message:", error);
        return null;
      }
    });