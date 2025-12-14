const path = require('path');

const createConfig = (
  entry,
  filename,
  libraryTarget,
  libraryName,
  outputModule = false
) => ({
  entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename,
    library: libraryName,
    libraryTarget,
    libraryExport: libraryName,
    globalObject: libraryTarget === 'umd' ? 'this' : undefined,
    ...(outputModule && { module: true }),
  },
  experiments: outputModule ? { outputModule: true } : undefined,
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  mode: 'production',
});

/* =========================
   ENTRY DEFINITIONS
   ========================= */

const entries = [
  // core
  'layout/index',

  // layout
  'layout/animator',
  'layout/text',
  'layout/image',
  'layout/link',
  'layout/flex-row',
  'layout/new-nav-bar',
  'layout/beta-desktop-bar',
  'layout/beta-mobile-bar',
  'layout/multiswitcher',
  'layout/side-bar',
  'layout/side-nav-bar',
  'layout/simple-bar',
  'layout/free',
  'layout/audionew',
  'layout/progress',
  'layout/center',
  'layout/code',
  'layout/stack',
  'layout/container',
  'layout/meta-adder',
  'layout/table',
  'layout/dropdown',
  'layout/modal-2025',
  'layout/text-field',
  'layout/flex-card',
  'layout/wrap',
  'layout/flex-grid',
  'layout/zoom-card',
  'layout/horizontal-scroller',
  'layout/checkbox',
  'layout/base',
  'layout/button',
  'layout/spacer',
  'layout/video',
  'layout/slider-2025',
  'layout/ulist',

  // form-components
  'layout/form-components/image-picker',
  'layout/form-components/picker',
  'layout/form-components/range',
  'layout/form-components/radio',
  'layout/form-components/data-list',
  'layout/form-components/floating-input',

  // lib
  'lib/element-mapper',
  'lib/designer',
  'lib/link-getter',
  'lib/card-getter',
  'lib/transform-anim',
  'lib/keyframe-animation',
  'lib/stacker',
  'lib/scroll-video',
];

/* =========================
   BUILD GENERATORS
   ========================= */

const esmBuilds = entries.map(entry =>
  createConfig(
    `./${entry}.js`,
    `${path.basename(entry)}.esm.js`,
    'module',
    undefined,
    true
  )
);

const cjsBuilds = entries.map(entry =>
  createConfig(
    `./${entry}.js`,
    `${path.basename(entry)}.cjs.js`,
    'commonjs2'
  )
);

/* =========================
   UMD / MERGED
   ========================= */

const umdBuilds = [
  createConfig('./layout/index.js', 'bundle.umd.js', 'umd', 'Bundle'),
  createConfig('./layout/index.js', 'finalresult.esm.js', 'module', undefined, true),
];

/* =========================
   EXPORT
   ========================= */

module.exports = [
  ...esmBuilds,
  ...cjsBuilds,
  ...umdBuilds,
];


    // run using
    // webpack --config webpack.config.js
    // or npm run build if you have build script in config.js
    //  npm install -g webpack


  
