const VoximplantApiClient = require("@voximplant/apiclient-nodejs").default;
const client = new VoximplantApiClient();
client.onReady = function(){
  // Delete the phone number.
  client.OutboundTestNumbers.delOutboundTestPhoneNumber({})
        .then(ev=>console.log(ev))
        .catch(err=>console.error(err));
};