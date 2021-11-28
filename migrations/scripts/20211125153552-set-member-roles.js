module.exports = {
  async up(db) {
    await db.collection('members').
      updateMany({},{$set : {"roles":["member"]}},{upsert:false,multi:true});
  },

  async down(db) {
    await db.collection('members').
      updateMany({},{$unset: {roles:1}},{upsert:false,multi:true});
  }
};
