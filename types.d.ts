// Tell TypeScript that <model-viewer> is a valid JSX element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}