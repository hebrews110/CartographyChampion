const WebpackBar = require('webpackbar');
const path = require('path');
/*const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;*/

var babelLoader = {
    loader: 'babel-loader',
    options: {
        cacheDirectory: false,
        presets: [ [ '@babel/preset-env', {
            debug: false,
            useBuiltIns: 'usage',
            corejs: '3',
            shippedProposals: true
            } ] ],
        sourceType: "unambiguous",
        plugins: ['@babel/plugin-transform-runtime']
    }
  };

var babelRegex = function(moduleName) {
    var retVal;
    if(moduleName.includes("country-list-js"))
        retVal = false;
    else if(!moduleName.includes("node_modules"))
        retVal = false;
    else
        retVal = true;
    return retVal;
}

function isProduction(env) {
    return typeof env != "undefined" && env.production;
}
module.exports = env => {
  return {
    entry: [ './main.ts', './styles.scss' ],
    mode: isProduction(env) ? 'production' : 'development',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
              babelLoader,
              { loader: 'ts-loader' }
          ],
          exclude: babelRegex,
        },
        {
          test: /\.s[ac]ss$/i,
          use: [
            // Creates `style` nodes from JS strings
            'style-loader',
            // Translates CSS into CommonJS
            'css-loader',
            // Compiles Sass to CSS
            'sass-loader',
          ],
        },
        {
          test: /\.js$/,
          exclude: babelRegex,
          use: [
            babelLoader
          ]
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          use: [
            {
              loader: 'file-loader',
              options: {
                  publicPath: "built"
              }
            },
          ],
        }
      ],
    },
    resolve: {
      extensions: [ '.tsx', '.ts', '.js' ],
    },
    output: {
      filename: '_bundled_code.js',
      path: path.resolve(__dirname, 'built')
    },
    devServer: {
      contentBase: '.',
      publicPath: '/built/',
      port: 8080
    },
    devtool: isProduction(env) ? false: 'inline-source-map',
    plugins: [
      new WebpackBar()
    ]
  };
};
