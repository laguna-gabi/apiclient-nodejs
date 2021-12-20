module.exports = {
  async up(db) {
    await db.collection('members').updateMany({}, { $unset: { readmissionRisk: '' } });
  },

  async down(db) {
    await db
      .collection('members')
      .updateMany({}, { $unset: { readmissionRisk: '', readmissionRiskHistory: '' } });
  },
};
