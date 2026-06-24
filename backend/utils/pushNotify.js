const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

webpush.setVapidDetails(
  process.env.VAPID_MAILTO || 'mailto:admin@staylite.in',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to all subscriptions matching a filter.
 * @param {object} filter  - mongoose query filter on PushSubscription
 * @param {object} payload - { title, body, url, icon }
 */
async function sendPush(filter, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    const subs = await PushSubscription.find(filter).lean();
    const dead = [];
    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify({
              title: payload.title || 'StayLite',
              body:  payload.body  || '',
              icon:  payload.icon  || '/favicon.svg',
              url:   payload.url   || '/',
            })
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub._id);
        }
      })
    );
    if (dead.length) await PushSubscription.deleteMany({ _id: { $in: dead } });
  } catch (err) {
    console.error('Push notify error:', err.message);
  }
}

/** Notify all staff (SUPER_ADMIN, PROPERTY_OWNER, HOTEL_MANAGER) for a property */
async function notifyPropertyStaff(propertyId, payload) {
  await sendPush(
    { $or: [{ propertyIds: propertyId }, { role: 'SUPER_ADMIN' }] },
    payload
  );
}

/** Notify all SUPER_ADMIN subscribers */
async function notifyAdmins(payload) {
  await sendPush({ role: 'SUPER_ADMIN' }, payload);
}

module.exports = { sendPush, notifyPropertyStaff, notifyAdmins };
