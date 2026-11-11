export const environment = {
	production: true,
	environmentName: 'Production',
	serverUrl: "https://api.1800limo.com/api/",
	// limo-rt socket for signed share links (/live-ride-tracking/<token>). Empty = token links show "not available".
	rtSocketUrl: 'wss://api.1800limo.com/rt/v1/ws',
	mistralSecretKey: "WvrrM5g1bmpJZjb3Go4d8tnUfZkNogmP",
	// TODO: point at this environment's AI chat server
	openAIUrl: "https://api.1800limo.com/chatbot",
	recaptchaEnterpriseKey: "6Lev_gstAAAAACll6pekSq467NHhw3Di-CGuV5_I",
	recaptchaKey: "6Lcf2MYqAAAAAMPwdv97BZ_LBwX-1e9y2NcFsoIn",
	encryptionKey:"BTEo5hJauptWuoKUqeTfVgEn1a6BOSXzNlSoN6SPQBI=",
};
