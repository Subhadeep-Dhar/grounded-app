const { getDefaultConfig } = require('expo/metro-config');
const config = require('../metro.config.js');
console.log('Source Exts:', config.resolver.sourceExts);
