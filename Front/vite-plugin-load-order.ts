import type { Plugin } from "vite";

export function loadOrderPlugin(): Plugin {
  return {
    name: "load-order-plugin",
    enforce: "post",
    transformIndexHtml(html) {
      // Convert modulepreload links to script tags with proper loading order
      // React vendor must load first, then MUI vendor
      return html
        .replace(
          /<link rel="modulepreload"[^>]*href="([^"]*react-vendor[^"]*)"[^>]*>/g,
          '<script type="module" src="$1"></script>'
        )
        .replace(
          /<link rel="modulepreload"[^>]*href="([^"]*mui-vendor[^"]*)"[^>]*>/g,
          ""
        )
        .replace(
          /<script type="module"[^>]*src="([^"]*index[^"]*)"[^>]*><\/script>/g,
          (match, indexPath) => {
            // Find the mui-vendor path from the original HTML
            const muiVendorMatch = html.match(/href="([^"]*mui-vendor[^"]*)"/);
            const muiVendorPath = muiVendorMatch ? muiVendorMatch[1] : "";

            return muiVendorPath
              ? `<script type="module" src="${muiVendorPath}"></script>\n    ${match}`
              : match;
          }
        );
    },
  };
}
