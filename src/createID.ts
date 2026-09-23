export function createID() {
  const Id = Math.random().toString().slice(2);
  return Id;
}
export function createCUID() {
  const CUId = Math.random().toString().slice(2, 6);
  return CUId;
}
