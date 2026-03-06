// import { google } from "googleapis";

// export const getWebmasters = (accessToken) => {
//   const auth = new google.auth.OAuth2();
//   auth.setCredentials({ access_token: accessToken });
//   return google.webmasters({ version: "v3", auth });
// };




import { google } from "googleapis";

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
