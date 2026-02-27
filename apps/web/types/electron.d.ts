export {};

declare global {
  interface Window {
    electronAPI?: {
      markFirstRunComplete: () => Promise<void>;
    };
  }
}
