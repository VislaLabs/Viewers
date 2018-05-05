const querystring = require("querystring");

WADOProxy.convertURL = (url, serverConfiguration) => {
    if (!Settings.enabled) {
        return url;
    }

    if (!url) {
        return null;
    }

    const serverId = serverConfiguration._id;
    console.log(`DICOM: ${url}`)
    const query = querystring.stringify({url, serverId});
    return `${Settings.uri}?${query}`;
}
