export const environment = {
	production: false,
	environmentName: 'Development',
	serverUrl: "http://10.20.10.132:8000/api/",
	// serverUrl: "https://1800limoapi.infodevbox.com/api/",
	// limo-rt socket for signed share links (/live-ride-tracking/<token>). Empty = token links show "not available".
	rtSocketUrl: 'wss://api.1800limo.com/rt/v1/ws',
	mistralSecretKey: "WvrrM5g1bmpJZjb3Go4d8tnUfZkNogmP",
	// TODO: point at this environment's AI chat server
	recaptchaEnterpriseKey: "6Lev_gstAAAAACll6pekSq467NHhw3Di-CGuV5_I",
	recaptchaKey: "6Lcf2MYqAAAAAMPwdv97BZ_LBwX-1e9y2NcFsoIn",
	// openAIUrl : "https://1800limochatbot.infodevbox.com",
	openAIUrl: "http://10.20.10.132:9000",
	// serverUrl: "http://localhost:8000/api/",
    encryptionKey:"BTEo5hJauptWuoKUqeTfVgEn1a6BOSXzNlSoN6SPQBI=",
	// serverUrl: "https://api.1800limo.com/api/"
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a n	egative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
