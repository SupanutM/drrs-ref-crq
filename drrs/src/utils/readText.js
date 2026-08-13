export const readTextFileToArray = (content) => {
  const header = content
    .slice(0, content.indexOf("\n"))
    .replace(/(?:\\[rn]|[\r\n]+)+/g, "")
    .split("|");
  const rows = content.slice(content.indexOf("\n") + 1).split("\n");
  const array = rows.map((i) => {
    const values = i.split("|");
    const obj = header.reduce((object, header, index) => {
      object[header] = values[index].replace(/(?:\\[rn]|[\r\n]+)+/g, "");
      return object;
    }, {});
    return obj;
  });
  return array;
};
