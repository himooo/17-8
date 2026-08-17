// Global type augmentations for Bisalasa

declare global {
  interface Window {
    __BISALASA_HYDRATED__?: boolean;
    __BISALASA_HYDRATION_COMPLETE__?: boolean;
  }
}

export {};
