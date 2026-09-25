const ABSOLUTE_HTTP_URL = /^https?:\/\//i;
const HEX_PAIR = /^[0-9a-f]{2}$/i;
const PATH_CHARACTER = /^[a-z0-9\-._~!$&'()*+,;=:@]$/i;

const encodePathSegment = (segment) => {
  let encoded = "";

  for (let index = 0; index < segment.length;) {
    if (segment[index] === "%" && HEX_PAIR.test(segment.slice(index + 1, index + 3))) {
      encoded += `%${segment.slice(index + 1, index + 3).toUpperCase()}`;
      index += 3;
      continue;
    }

    const character = String.fromCodePoint(segment.codePointAt(index));
    encoded += PATH_CHARACTER.test(character) ? character : encodeURIComponent(character);
    index += character.length;
  }

  return encoded;
};

export function encodeRequestUrl(input, baseUrl) {
  const hashEncodedInput = input.replaceAll("#", "%23");
  const isAbsolute = ABSOLUTE_HTTP_URL.test(hashEncodedInput);
  const url = new URL(hashEncodedInput, baseUrl);

  url.pathname = url.pathname.split("/").map(encodePathSegment).join("/");
  url.search = url.searchParams.toString();
  url.hash = "";

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
}
