module.exports = (config, context) => {
  return {
    ...config,
    optimization: {
      nodeEnv: false,
    },
  };
};
