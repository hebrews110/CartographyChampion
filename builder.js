const { rollup } = require('rollup');
const chokidar = require('chokidar');
const liveserver = require('live-server');

liveserver.start({
    port: 8080,
    root: '.',
    open: false,
    ignore: 'intermediate'
});

var defaultConfig = require('./rollup.config.js');

async function bundleChange(event, path) {
    await rollup(defaultConfig);
    console.log("Finished bundling JavaScript");
}
async function mainfunc() {
    await bundleChange();

    chokidar.watch('intermediate').on('all', bundleChange);
}

mainfunc();
