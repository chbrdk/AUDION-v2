/* global Office */
import { SelectionMetadata } from '../types';

export class OfficeService {
  static async getSelection(): Promise<SelectionMetadata | null> {
    return new Promise((resolve) => {
      Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          // This is a simplified version. For more complex selections (shapes), 
          // we would need to use the PowerPoint-specific APIs.
          resolve({
            nodeId: 'selected-text',
            name: 'Selected Text',
            type: 'SHAPE',
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            presentationId: Office.context.document.url,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  static async getSelectedShapes(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      PowerPoint.run(async (context) => {
        const selectedShapes = context.presentation.getSelectedShapes();
        selectedShapes.load('items/name,items/id,items/type');
        await context.sync();
        resolve(selectedShapes.items);
      }).catch(reject);
    });
  }

  static async captureSlideAsImage(): Promise<string | null> {
    return new Promise((resolve) => {
      // PowerPoint JS API doesn't have a direct "export as image" like Figma.
      // Usually, we might need a backend service to render the slide or use 
      // some workarounds if available in the specific Office version.
      // For now, return null or a placeholder.
      resolve(null);
    });
  }

  static async addTextToSlide(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      Office.context.document.setSelectedDataAsync(text, { coercionType: Office.CoercionType.Text }, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(new Error(result.error.message));
        }
      });
    });
  }
}
