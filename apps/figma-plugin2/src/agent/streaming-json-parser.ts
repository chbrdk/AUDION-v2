/**
 * A lightweight parser to extract individual objects from a streaming JSON.
 * Can be configured to extract objects from a top-level array (depth 0)
 * or from an array nested within a root object (depth 1).
 */
export class StreamingJsonParser {
  private buffer: string = "";
  private depth: number = 0;
  private inString: boolean = false;
  private isEscaped: boolean = false;
  private targetDepth: number;

  /**
   * @param targetDepth The depth at which to look for complete objects. 
   *                    0 for a plain array [...], 
   *                    1 for a nested array {"key": [...]}.
   */
  constructor(targetDepth: number = 0) {
    this.targetDepth = targetDepth;
  }

  /**
   * Appends a chunk of text and returns any complete objects found.
   */
  ingest(chunk: string): any[] {
    const objects: any[] = [];
    
    for (const char of chunk) {
      this.buffer += char;

      if (this.isEscaped) {
        this.isEscaped = false;
        continue;
      }

      if (char === '\\') {
        this.isEscaped = true;
        continue;
      }

      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }

      if (!this.inString) {
        if (char === '{' || char === '[') {
          if (char === '{' && this.depth === this.targetDepth) {
            // Start of a new potential object at the target level
            this.buffer = "{";
          }
          this.depth++;
        } else if (char === '}' || char === ']') {
          this.depth--;
          if (this.depth === this.targetDepth && this.buffer.startsWith('{')) {
            // Potential complete object
            try {
              const obj = JSON.parse(this.buffer);
              objects.push(obj);
              this.buffer = "";
            } catch (e) {
              // Not yet complete or invalid JSON
            }
          }
        }
      }
    }
    
    return objects;
  }
}
