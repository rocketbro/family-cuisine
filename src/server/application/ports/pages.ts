export type PageFetcherPort = {
  fetch(url: string): Promise<{ url: string; siteName: string; content: string }>;
};
