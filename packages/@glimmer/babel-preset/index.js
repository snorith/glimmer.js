const generateVmPlugins = require('@glimmer/vm-babel-plugins');

function defaultTo(value, defaultVal) {
  return value === undefined ? defaultVal : value;
}

module.exports = function (api, options) {
  let isDebug = defaultTo(options.isDebug, api.environment ? !api.environment('production') : true);
  let __loadPlugins = options.__loadPlugins === undefined ? false : options.__loadPlugins;
  let __customInlineTemplateModules = defaultTo(options.__customInlineTemplateModules, {});

  let precompile, templateCompilerPath;

  const looseProps =
    typeof options.loose === 'object' &&
    options.loose !== null &&
    typeof options.loose.properties === 'boolean'
      ? options.loose.properties
      : false;

  if (options.precompile) {
    precompile = options.precompile;
  } else {
    templateCompilerPath = options.templateCompilerPath || require.resolve('@glimmer/compiler');
  }

  return {
    plugins: [
      ...generateVmPlugins({ __loadPlugins, isDebug }),
      [
        __loadPlugins
          ? require('babel-plugin-debug-macros')
          : require.resolve('babel-plugin-debug-macros'),
        {
          debugTools: {
            source: '@norith/glimmer-debug',
            isDebug,
          },
          externalizeHelpers: {
            module: true,
          },
        },
        'glimmer-debug-macros',
      ],

      [
        __loadPlugins
          ? require('babel-plugin-htmlbars-inline-precompile')
          : require.resolve('babel-plugin-htmlbars-inline-precompile'),
        {
          templateCompilerPath,
          precompile,
          isProduction: !isDebug,
          ensureModuleApiPolyfill: false,
          moduleOverrides: {
            '@ember/component/template-only': {
              default: ['templateOnlyComponent', '@norith/glimmer-core'],
            },
            '@ember/template-factory': {
              createTemplateFactory: ['createTemplateFactory', '@norith/glimmer-core'],
            },
            '@ember/component': {
              setComponentTemplate: ['setComponentTemplate', '@norith/glimmer-core'],
            },
          },
          modules: {
            ...__customInlineTemplateModules,
            // Support both original and renamed import paths
            // (consumer apps may use npm aliases to keep '@glimmer/core')
            '@glimmer/core': {
              export: 'precompileTemplate',
              disableTemplateLiteral: true,
              shouldParseScope: true,
            },
            '@norith/glimmer-core': {
              export: 'precompileTemplate',
              disableTemplateLiteral: true,
              shouldParseScope: true,
            },
          },
        },
        'glimmer-inline-precompile',
      ],

      [
        __loadPlugins
          ? require('@babel/plugin-proposal-decorators')
          : require.resolve('@babel/plugin-proposal-decorators'),
        { legacy: true },
      ],

      [
        __loadPlugins
          ? require('@babel/plugin-proposal-class-properties')
          : require.resolve('@babel/plugin-proposal-class-properties'),
        { loose: looseProps },
      ],

      [
        __loadPlugins
          ? require('@babel/plugin-proposal-private-methods')
          : require.resolve('@babel/plugin-proposal-private-methods'),
        { loose: looseProps },
      ],
    ],
  };
};
