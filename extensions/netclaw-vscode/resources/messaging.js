// VS Code recreates a hidden webview's scripts when the tab is revealed.
// Keep message IDs monotonic without retaining the entire hidden document.
window.netclawPost = (api, viewId) => {
  const saved = api.getState();
  let sequence =
    saved?.viewId === viewId &&
    Number.isSafeInteger(saved.sequence) &&
    saved.sequence >= 0
      ? saved.sequence
      : 0;
  return (type, fields = {}) => {
    api.setState({ viewId, sequence: ++sequence });
    api.postMessage({ ...fields, type, viewId, requestId: String(sequence) });
  };
};
