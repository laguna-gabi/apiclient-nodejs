module.exports = {
  async up(db) {
    await db.collection('schedulers').drop();

    try {
      //incase this collection doesn't exist
      await db.collection('notifyparams').drop();
    } catch (ex) {
      console.log(ex);
    }
  },
};
