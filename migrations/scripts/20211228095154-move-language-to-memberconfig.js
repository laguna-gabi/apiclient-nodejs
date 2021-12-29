module.exports = {
  async up(db) {
    await db.collection('members').updateMany({}, { $unset: { language: '' } });
    await db.collection('memberconfigs').updateMany({}, { $set: { language: 'en' } });
  },

  async down(db) {
    await db.collection('members').updateMany({}, { $set: { language: 'en' } });
    await db.collection('memberconfigs').updateMany({}, { $unset: { language: '' } });
  },
};
