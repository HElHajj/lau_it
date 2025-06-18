// Content for functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database'); // Import getDatabase

admin.initializeApp();
const db = getDatabase(); // Initialize Realtime Database

exports.onClassroomIssueReported = functions.database.ref('{campusId}/issues/{issueId}')
    .onCreate(async (snapshot, context) => {
        const issueData = snapshot.val();
        const campusId = context.params.campusId;
        const issueId = context.params.issueId;

        if (issueData.status && issueData.status !== 'reported') {
            return console.log('Issue is not in "reported" status, skipping notification.');
        }

        console.log(`New classroom issue reported on ${campusId}:`, issueData);

        const adminTokensSnapshot = await db.ref('notificationTokens/admin').once('value');
        const supportTokensSnapshot = await db.ref('notificationTokens/support').once('value');

        const tokens = [];
        if (adminTokensSnapshot.exists()) {
            Object.keys(adminTokensSnapshot.val()).forEach(tokenKey => tokens.push(tokenKey.replace(/_/g, '.')));
        }
        if (supportTokensSnapshot.exists()) {
            Object.keys(supportTokensSnapshot.val()).forEach(tokenKey => tokens.push(tokenKey.replace(/_/g, '.')));
        }

        if (tokens.length === 0) {
            return console.log('No notification tokens found for admins/support.');
        }

        const payload = {
            notification: {
                title: `🔴 New Classroom Issue on ${campusId.toUpperCase()}`,
                body: `Classroom: ${issueData.building} Level ${issueData.level} Room ${issueData.classroom} - Issue: ${issueData.issues}`,
                icon: '/pics/lau_icon.png',
                click_action: `https://lau-support-system.firebaseapp.com/${campusId}_classrooms.html?building=${issueData.building}&level=Level ${issueData.level}&room=${issueData.classroom}&mode=single&filterClassroomIssues=true`
            },
            data: {
                type: 'classroom_issue',
                campus: campusId,
                building: issueData.building,
                level: issueData.level,
                room: issueData.room,
                issue_id: issueId
            }
        };

        const response = await admin.messaging().sendToDevice(tokens, payload);
        console.log('Notification sent for classroom issue:', response);

        const tokensToRemove = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokens[index], error);
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    tokensToRemove.push(db.ref(`notificationTokens/admin/${tokens[index].replace(/\./g, '_')}`).remove());
                    tokensToRemove.push(db.ref(`notificationTokens/support/${tokens[index].replace(/\./g, '_')}`).remove());
                }
            }
        });
        return Promise.all(tokensToRemove);
    });

exports.onOfficeIssueReported = functions.database.ref('Offices/allOfficeIssues/{issueId}')
    .onCreate(async (snapshot, context) => {
        const issueData = snapshot.val();
        const issueId = context.params.issueId;

        if (issueData.status && issueData.status !== 'Reported') {
            return console.log('Office issue is not in "Reported" status, skipping notification.');
        }

        console.log(`New office issue reported:`, issueData);

        const adminTokensSnapshot = await db.ref('notificationTokens/admin').once('value');
        const supportTokensSnapshot = await db.ref('notificationTokens/support').once('value');

        const tokens = [];
        if (adminTokensSnapshot.exists()) {
            Object.keys(adminTokensSnapshot.val()).forEach(tokenKey => tokens.push(tokenKey.replace(/_/g, '.')));
        }
        if (supportTokensSnapshot.exists()) {
            Object.keys(supportTokensSnapshot.val()).forEach(tokenKey => tokens.push(tokenKey.replace(/_/g, '.')));
        }

        if (tokens.length === 0) {
            return console.log('No notification tokens found for admins/support for office issue.');
        }

        const payload = {
            notification: {
                title: `🏢 New Office Issue`,
                body: `User: ${issueData.userName}, Bldg: ${issueData.officeBuilding}, Room: ${issueData.officeRoom} - Category: ${issueData.officeIssueCategory}`,
                icon: '/pics/lau_icon.png',
                click_action: `https:/lau-support-system.firebaseapp.com/offices.html`
            },
            data: {
                type: 'office_issue',
                issue_id: issueId,
                building: issueData.officeBuilding,
                room: issueData.officeRoom,
                category: issueData.officeIssueCategory
            }
        };

        const response = await admin.messaging().sendToDevice(tokens, payload);
        console.log('Notification sent for office issue:', response);

        const tokensToRemove = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokens[index], error);
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    tokensToRemove.push(db.ref(`notificationTokens/admin/${tokens[index].replace(/\./g, '_')}`).remove());
                    tokensToRemove.push(db.ref(`notificationTokens/support/${tokens[index].replace(/\./g, '_')}`).remove());
                }
            }
        });
        return Promise.all(tokensToRemove);
    });