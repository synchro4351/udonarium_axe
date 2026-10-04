const DOT = '__dot__';
const DOTTED_NAME = /(\s)([A-Za-z_][\w:-]*(?:\.[\w:-]+)+)(=")/g;

/**
 * Lets happy-dom read saved XML whose attribute names carry dots, such as `location.name`.
 *
 * Browsers read them; happy-dom's XML parser stops at the first one, which leaves a character's
 * own XML, and so `clone()`, unusable in tests. The names are hidden before parsing and put back
 * on the parsed elements. Returns the function that restores the parser.
 */
export function allowDottedXmlAttributes(): () => void {
  const original = DOMParser.prototype.parseFromString;
  DOMParser.prototype.parseFromString = function (this: DOMParser, text: string, type: DOMParserSupportedType) {
    if (type !== 'application/xml' && type !== 'text/xml') return original.call(this, text, type);
    const hidden = text.replace(DOTTED_NAME, (_, space: string, name: string, equals: string) => {
      return space + name.split('.').join(DOT) + equals;
    });
    const document = original.call(this, hidden, type);
    for (const element of Array.from(document.getElementsByTagName('*'))) {
      for (const attribute of Array.from(element.attributes)) {
        if (!attribute.name.includes(DOT)) continue;
        element.removeAttribute(attribute.name);
        element.setAttribute(attribute.name.split(DOT).join('.'), attribute.value);
      }
    }
    return document;
  } as typeof DOMParser.prototype.parseFromString;
  return () => {
    DOMParser.prototype.parseFromString = original;
  };
}
