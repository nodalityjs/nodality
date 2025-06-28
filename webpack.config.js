const path = require('path');

const createConfig = (entry, filename, libraryTarget, libraryName, outputModule = false) => ({
  entry: entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: filename,
    library: libraryName, // Set a global variable directly
    libraryTarget: libraryTarget,
    libraryExport: libraryName,
    globalObject: libraryTarget === 'umd' ? 'this' : undefined, // Use 'this' for browser and Node.js compatibility
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
        },
      },
    ],
  },
  mode: 'production',
});

module.exports = [
    // EMS
    createConfig('./layout/index.js', 'index.esm.js', 'module', undefined, true),
   // createConfig('./Users/filipvabrousek/desktop/layout/designertest/lib/elementMapper.js', 'elementMapper.esm.js', 'module', undefined, true),
    //
    createConfig('./lib/elementMapper.js', 'elementMapper.esm.js', 'module', undefined, true),
    createConfig('./layout/animator.js', 'animator.esm.js', 'module', undefined, true),
    createConfig('./layout/text.js', 'text.esm.js', 'module', undefined, true),
    createConfig('./layout/image.js', 'image.esm.js', 'module', undefined, true),
    createConfig('./layout/link.js', 'link.esm.js', 'module', undefined, true),
    createConfig('./layout/flexRow.js', 'flexRow.esm.js', 'module', undefined, true),
    createConfig('./layout/newNavBar.js', 'newNavBar.esm.js', 'module', undefined, true),
   
    // BETA
    createConfig('./layout/betaDesktopBar.js', 'betaDesktopBar.esm.js', 'module', undefined, true),
    createConfig('./layout/betaMobileBar.js', 'betaMobileBar.esm.js', 'module', undefined, true),
    createConfig('./layout/multiswitcher.js', 'multiswitchers.esm.js', 'module', undefined, true),
   
    createConfig('./layout/sideBar.js', 'sideBar.esm.js', 'module', undefined, true),
    createConfig('./layout/simpleBar.js', 'simpleBar.esm.js', 'module', undefined, true),
    createConfig('./layout/sideNavBar.js', 'sideNavBar.esm.js', 'module', undefined, true),
    createConfig('./layout/free.js', 'free.esm.js', 'module', undefined, true),
    createConfig('./layout/audionew.js', 'audionew.esm.js', 'module', undefined, true),
    createConfig('./layout/progress.js', 'progress.esm.js', 'module', undefined, true),
    createConfig('./layout/center.js', 'center.esm.js', 'module', undefined, true),
    createConfig('./layout/code.js', 'code.esm.js', 'module', undefined, true),
    createConfig('./layout/stack.js', 'stack.esm.js', 'module', undefined, true),
    createConfig('./layout/container.js', 'container.esm.js', 'module', undefined, true),
    createConfig('./layout/metaAdder.js', 'metaAdder.esm.js', 'module', undefined, true),
    createConfig('./layout/table.js', 'table.esm.js', 'module', undefined, true),
    createConfig('./layout/dropdown.js', 'dropdown.esm.js', 'module', undefined, true),
    createConfig('./layout/modal2025.js', 'modal2025.esm.js', 'module', undefined, true),
    createConfig('./layout/textField.js', 'textField.esm.js', 'module', undefined, true),
    createConfig('./layout/flexCard.js', 'flexCard.esm.js', 'module', undefined, true),
    createConfig('./layout/wrap.js', 'wrap.esm.js', 'module', undefined, true),
    createConfig('./layout/flexGrid.js', 'flexGrid.esm.js', 'module', undefined, true),
    createConfig('./layout/zoomCard.js', 'zoomCard.esm.js', 'module', undefined, true),
    createConfig('./layout/horizontalScroller.js', 'horizontalScroller.esm.js', 'module', undefined, true),
    createConfig('./layout/checkbox.js', 'checkbox.esm.js', 'module', undefined, true),
    createConfig('./layout/base.js', 'base.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/imagePicker.js', 'imagePicker.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/picker.js', 'picker.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/range.js', 'range.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/radio.js', 'radio.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/dataList.js', 'datalist.esm.js', 'module', undefined, true),
    createConfig('./layout/formComponents/floatingInput.js', 'floatingInput.esm.js', 'module', undefined, true),
    createConfig('./layout/button.js', 'button.esm.js', 'module', undefined, true),
    createConfig('./lib/designer.js', 'designer.esm.js', 'module', undefined, true),
    //createConfig('./lib/storage.js', 'storage.esm.js', 'module', undefined, true),
      createConfig('./lib/linkGetter.js', 'linkGetter.esm.js', 'module', undefined, true),
        createConfig('./lib/cardGetter.js', 'cardGetter.esm.js', 'module', undefined, true),
// add CardGen, LinkStyler, Storage
    
    // COMMONJS
    createConfig('./layout/index.js', 'index.cjs.js', 'commonjs2'),
  //  createConfig('./Users/filipvabrousek/desktop/layout/designertest/lib/elementMapper.js', 'elementMapper.cjs.js', 'commonjs2'),
    createConfig('./lib/elementMapper.js', 'elementMapper.cjs.js', 'commonjs2'),
    createConfig('./layout/animator.js', 'animator.cjs.js', 'commonjs2'),
    createConfig('./layout/text.js', 'text.cjs.js', 'commonjs2'),
    createConfig('./layout/image.js', 'image.cjs.js', 'commonjs2'),
    createConfig('./layout/link.js', 'link.cjs.js', 'commonjs2'),
    createConfig('./layout/flexRow.js', 'flexRow.cjs.js', 'commonjs2'),
    createConfig('./layout/newNavBar.js', 'newNavBar.cjs.js', 'commonjs2'),

    createConfig('./layout/betaDesktopBar.js', 'betaDesktopBar.esm.js', "commonjs2"),
    createConfig('./layout/betaMobileBar.js', 'betaMobileBar.esm.js', "commonjs2"),
    createConfig('./layout/multiswitcher.js', 'multiswitchers.esm.js', "commonjs2"),

    createConfig('./layout/sideBar.js', 'sideBar.cjs.js', 'commonjs2'),
    createConfig('./layout/sideNavBar.js', 'sideNavBar.cjs.js', 'commonjs2'),
    createConfig('./layout/simpleBar.js', 'simpleBar.cjs.js', 'commonjs2'),
    createConfig('./layout/free.js', 'free.cjs.js', 'commonjs2'),
    createConfig('./layout/audionew.js', 'audionew.cjs.js', 'commonjs2'),
    createConfig('./layout/progress.js', 'progress.cjs.js', 'commonjs2'),
    createConfig('./layout/center.js', 'center.cjs.js', 'commonjs2'),
    createConfig('./layout/code.js', 'code.cjs.js', 'commonjs2'),
    createConfig('./layout/stack.js', 'stack.cjs.js', 'commonjs2'),
    createConfig('./layout/container.js', 'container.cjs.js', 'commonjs2'),
    createConfig('./layout/metaAdder.js', 'metaAdder.cjs.js', 'commonjs2'),
    createConfig('./layout/table.js', 'table.cjs.js', 'commonjs2'),
    createConfig('./layout/dropdown.js', 'dropdown.cjs.js', 'commonjs2'),
    createConfig('./layout/modal2025.js', 'modal2025.cjs.js', 'commonjs2'),
    createConfig('./layout/textField.js', 'textField.cjs.js', 'commonjs2'),
    createConfig('./layout/flexCard.js', 'flexCard.cjs.js', 'commonjs2'),
    createConfig('./layout/wrap.js', 'wrap.cjs.js', 'commonjs2'),
    createConfig('./layout/flexGrid.js', 'flexGrid.cjs.js', 'commonjs2'),
    createConfig('./layout/zoomCard.js', 'zoomCard.cjs.js', 'commonjs2'),
    createConfig('./layout/checkbox.js', 'checkbox.cjs.js', 'commonjs2'),
    createConfig('./layout/base.js', 'base.cjs.js', 'commonjs2'),
    createConfig('./layout/formComponents/imagePicker.js', 'imagePicker.cjs.js', 'commonjs2'),
    createConfig('./layout/formComponents/picker.js', 'picker.cjs.js', 'commonjs2'),
    createConfig('./layout/formComponents/range.js', 'range.cjs.js',  'commonjs2'),
    createConfig('./layout/formComponents/radio.js', 'radio.cjs.js', 'commonjs2'),
    createConfig('./layout/formComponents/dataList.js', 'datalist.cjs.js', 'commonjs2'),
    createConfig('./layout/formComponents/floatingInput.js', 'floatingInput.cjs.js', 'commonjs2'),
    createConfig('./layout/button.js', 'button.cjs.js', 'commonjs2'),
    createConfig('./lib/designer.js', 'designer.cjs.js', 'commonjs2'),

    createConfig('./lib/linkGetter.js', 'linkGetter.cjs.js', 'commonjs2'),
    createConfig('./lib/cardGetter.js', 'cardGetter.cjs.js', 'commonjs2'),
    //createConfig('./lib/storage.js', 'storage.cjs.js', 'commonjs2'),

   // createConfig('./layout/horizontalScroller.js', 'horizontalScroller.cjs.js', 'module', undefined, true),
    
    // MERGE (UMD ONLY)
    createConfig('./layout/index.js', 'bundle.umd.js', 'umd', 'Bundle'), // Add a merged UMD bundle
    createConfig('./layout/index.js', 'finalresult.esm.js', 'module', undefined, true),
    ];

    // run using
    // webpack --config webpack.config.js
    // or npm run build if you have build script in config.js
    //  npm install -g webpack


  
