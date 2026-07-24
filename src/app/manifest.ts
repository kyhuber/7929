import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "7929 — Home Maintenance",
    short_name: "7929",
    description: "What needs doing right now at 7929 17th Ave SW",
    start_url: "/",
    display: "standalone",
    background_color: "#EAE0CF",
    theme_color: "#EAE0CF",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
