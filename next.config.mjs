/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Apple schreibt diesen Pfad vor, und weder app/ noch public/ mögen
        // Ordnernamen, die mit einem Punkt beginnen — siehe den Kommentar in
        // der Route. Die Umschreibung führt den vorgeschriebenen Pfad auf
        // eine gewöhnliche Route, die es zuverlässig gibt.
        source: "/.well-known/apple-developer-merchantid-domain-association",
        destination: "/api/apple-pay-domain-association",
      },
    ];
  },
};

export default nextConfig;
