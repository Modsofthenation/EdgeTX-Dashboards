const MIN_NODE = [22, 13, 0];

export function assertNodeVersion(): void {
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  const ok =
    major > MIN_NODE[0] ||
    (major === MIN_NODE[0] && minor > MIN_NODE[1]) ||
    (major === MIN_NODE[0] && minor === MIN_NODE[1] && patch >= MIN_NODE[2]);

  if (!ok) {
    throw new Error(
      `Node.js ${MIN_NODE.join(".")}+ is required (@cursor/sdk). Current: ${process.versions.node}`
    );
  }
}
