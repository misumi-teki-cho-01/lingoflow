/**
 * Minimal ambient type declaration for the `turndown` package.
 * Install @types/turndown for full typings if needed in the future.
 */
declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "+" | "*";
    codeBlockStyle?: "indented" | "fenced";
    fence?: string;
    emDelimiter?: "_" | "*";
    strongDelimiter?: "__" | "**";
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
  }

  interface Rule {
    filter: string | string[] | ((node: HTMLElement, options: TurndownOptions) => boolean);
    replacement: (content: string, node: HTMLElement, options: TurndownOptions) => string;
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(input: string | HTMLElement | Document): string;
    addRule(key: string, rule: Rule): this;
    use(plugin: ((service: TurndownService) => void) | ((service: TurndownService) => void)[]): this;
    keep(filter: Rule["filter"]): this;
    remove(filter: Rule["filter"]): this;
    escape(str: string): string;
  }

  export = TurndownService;
}
