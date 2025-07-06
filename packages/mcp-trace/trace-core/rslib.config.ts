import { defineConfig } from '@rslib/core';

const BANNER = `/**
* Copyright (c) 2025 Bytedance, Inc. and its affiliates.
* SPDX-License-Identifier: alibaba
*/`;

export default defineConfig({
  source: {
    entry: {
      index: [
        'src/**/*.ts',
        'src/**/*.tsx',
        'src/**/*.css',
        '!src/**/*.{test,bench}.ts',
      ],
    },
  },
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      bundle: false,
      dts: true,
      banner: { js: BANNER },
    },
    {
      format: 'esm',
      syntax: 'es2021',
      bundle: false,
      dts: true,
      banner: { js: BANNER },
    },
  ],
  output: {
    target: 'web',
    cleanDistPath: true,
    sourceMap: true,
  },
});
