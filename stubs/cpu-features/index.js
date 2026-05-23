// Stub for cpu-features — ssh2 uses this to pick AES-NI vs software crypto.
// Returning {} tells ssh2 no hardware acceleration is available; it falls back
// to pure-JS crypto, which is slightly slower but fully correct.
module.exports = function cpuFeatures() { return {}; };
