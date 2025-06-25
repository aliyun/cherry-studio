// electron.vite.config.ts
import react from "@vitejs/plugin-react-swc";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
var __electron_vite_injected_dirname = "E:\\AI\\cherry-studio";
var visualizerPlugin = (type) => {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : [];
};
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), ...visualizerPlugin("main")],
    resolve: {
      alias: {
        "@main": resolve("src/main"),
        "@types": resolve("src/renderer/src/types"),
        "@shared": resolve("packages/shared"),
        "@mcp-trace/trace-core": resolve("packages/mcp-trace/trace-core/src"),
        "@mcp-trace/trace-web": resolve("packages/mcp-trace/trace-web/src"),
        "@mcp-trace/trace-node": resolve("packages/mcp-trace/trace-node/src")
      }
    },
    build: {
      rollupOptions: {
        external: ["@libsql/client", "bufferutil", "utf-8-validate"],
        output: {
          // 彻底禁用代码分割 - 返回 null 强制单文件打包
          manualChunks: void 0,
          // 内联所有动态导入，这是关键配置
          inlineDynamicImports: true
        }
      },
      sourcemap: process.env.NODE_ENV === "development"
    },
    optimizeDeps: {
      noDiscovery: process.env.NODE_ENV === "development"
    }
  },
  preload: {
    plugins: [
      react({
        tsDecorators: true
      }),
      externalizeDepsPlugin()
    ],
    resolve: {
      alias: {
        "@shared": resolve("packages/shared"),
        "@mcp-trace/trace-core": resolve("packages/mcp-trace/trace-core/src"),
        "@mcp-trace/trace-web": resolve("packages/mcp-trace/trace-web/src"),
        "@mcp-trace/trace-node": resolve("packages/mcp-trace/trace-node/src")
      }
    },
    build: {
      sourcemap: process.env.NODE_ENV === "development"
    }
  },
  renderer: {
    plugins: [
      react({
        tsDecorators: true,
        plugins: [
          [
            "@swc/plugin-styled-components",
            {
              displayName: true,
              // 开发环境下启用组件名称
              fileName: false,
              // 不在类名中包含文件名
              pure: true,
              // 优化性能
              ssr: false
              // 不需要服务端渲染
            }
          ]
        ]
      }),
      ...visualizerPlugin("renderer")
    ],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("packages/shared"),
        "@mcp-trace/trace-core": resolve("packages/mcp-trace/trace-core/src"),
        "@mcp-trace/trace-web": resolve("packages/mcp-trace/trace-web/src"),
        "@mcp-trace/trace-node": resolve("packages/mcp-trace/trace-node/src")
      }
    },
    optimizeDeps: {
      exclude: ["pyodide"]
    },
    worker: {
      format: "es"
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          miniWindow: resolve(__electron_vite_injected_dirname, "src/renderer/miniWindow.html"),
          selectionToolbar: resolve(__electron_vite_injected_dirname, "src/renderer/selectionToolbar.html"),
          selectionAction: resolve(__electron_vite_injected_dirname, "src/renderer/selectionAction.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
