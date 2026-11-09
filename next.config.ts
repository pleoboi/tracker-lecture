import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev uniquement : permet d'ouvrir le serveur local depuis un téléphone du même Wi-Fi
  allowedDevOrigins: ["192.168.*.*", "172.16.*.*", "10.*.*.*"],
};

export default nextConfig;
