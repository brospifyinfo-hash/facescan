// Is a Vercel Blob store attached to this project?
//
// Its own module rather than an export from the upload route: importing a
// non-handler symbol across route files works, but it makes one route's
// module graph depend on another's for a constant, and route files are the
// one place in a Next app where that is easy to get wrong.
//
// The token is injected by Vercel when a Blob store is connected. Absent, the
// admin form falls back to an image-URL field instead of a file picker.
export const blobConfigured = (): boolean =>
  typeof process.env.BLOB_READ_WRITE_TOKEN === "string" &&
  process.env.BLOB_READ_WRITE_TOKEN.length > 0;
