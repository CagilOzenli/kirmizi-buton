const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.onPress = onDocumentCreated(
  { document: 'presses/{pressId}', region: 'europe-west1' },
  async (event) => {
    const press = event.data.data();
    const devicesSnap = await db.collection('devices').get();
    const messages = [];
    devicesSnap.forEach((docSnap) => {
      const device = docSnap.data();
      if (device.token === press.senderToken) return;
      messages.push({
        to: device.token,
        sound: 'default',
        title: 'Düğmeye basıldı!',
        body: `${press.name} düğmeye bastı.`,
        priority: 'high',
      });
    });
    if (messages.length === 0) return null;

    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }
    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
    }
    return null;
  }
);