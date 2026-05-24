const requireJvHeader = require('./rules/require-jv-header');

module.exports = {
  plugins: {
    jv: {
      rules: {
        'require-jv-header': requireJvHeader,
      },
    },
  },
  rules: {
    'jv/require-jv-header': 'error',
  },
};
