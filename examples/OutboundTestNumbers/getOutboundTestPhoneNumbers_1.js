const VoximplantApiClient = require("@voximplant/apiclient-nodejs").default;
const client = new VoximplantApiClient();
client.onReady = function(){
  // Get the phone number info.
  client.OutboundTestNumbers.getOutboundTestPhoneNumbers({})
        .then(ev=>console.log(ev))
        .catch(err=>console.error(err));
};