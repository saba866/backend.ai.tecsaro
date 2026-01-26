import { google } from "googleapis";

export const getWebmasters = (accessToken) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.webmasters({ version: "v3", auth });
};
