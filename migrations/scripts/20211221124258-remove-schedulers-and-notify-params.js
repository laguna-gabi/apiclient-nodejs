module.exports = {
  async up(db) {
    await db.collection('notifyparams').drop();
    await db.collection('schedulers').drop();
  },
};
