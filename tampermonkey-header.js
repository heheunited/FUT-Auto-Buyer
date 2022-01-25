module.exports = {
  headers: {
    name: "FUT Auto Buyer",
    namespace: "http://tampermonkey.net/",
    version: "1.2.1",
    description: "FUT Auto Buyer",
    author: "ZZ",
    match: [
      "https://www.ea.com/*/fifa/ultimate-team/web-app/*",
      "https://www.ea.com/fifa/ultimate-team/web-app/*",
    ],
    grant: ["GM_xmlhttpRequest"],
    connect: ["ea.com", "ea2.com", "futbin.com", "discordapp.com"],
    require: [
      "https://github.com/chithakumar13/fut-trade-enhancer/releases/latest/download/fut-trade-enhancer.user.js",
      "https://raw.githubusercontent.com/discordjs/discord.js/webpack/discord.11.6.4.min.js",
    ],
    // updateURL:
    //   "https://github.com/chithakumar13/fut-auto-buyer/releases/latest/download/fut-auto-buyer.user.js",
    // downloadURL:
    //   "https://github.com/chithakumar13/fut-auto-buyer/releases/latest/download/fut-auto-buyer.user.js",
    noFrame: true,
  },
};
