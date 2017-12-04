var path = require("path");
var webpack = require("webpack");
const pro = process.argv.indexOf("-p") !== -1;
var entry = pro
  ? ["./src/index.js"]
  : [
      "./src/index.js",
      "webpack/hot/dev-server",
      "webpack-dev-server/client?http://localhost:8080"
    ];
var plugins = pro
  ? []
  : [new webpack.HotModuleReplacementPlugin()];

module.exports = {
  entry,
  plugins,
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/dist/",
    filename: "bundle.js"
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: "babel-loader",
      }
    ]
  }
};
if (!pro) {
  module.exports.devtool = "#source-map";
}
