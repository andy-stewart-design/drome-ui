// Array Value
// Get the value from an array
function av(arr: Float32Array<ArrayBufferLike> | number[], n: number) {
  return arr[n] ?? arr[0];
}

export { av };
