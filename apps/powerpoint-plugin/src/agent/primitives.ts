// Wireframe Primitives for the AI Agent

export const WIREFRAME_COLORS = {
  white: { r: 1, g: 1, b: 1 },
  lightGrey: { r: 0.96, g: 0.96, b: 0.96 },
  midGrey: { r: 0.88, g: 0.88, b: 0.88 },
  darkGrey: { r: 0.2, g: 0.2, b: 0.2 },
  black: { r: 0, g: 0, b: 0 }
};

export const TYPOGRAPHY = {
  h1: { size: 32, family: 'Inter', style: 'Bold', color: WIREFRAME_COLORS.black },
  h2: { size: 24, family: 'Inter', style: 'Bold', color: WIREFRAME_COLORS.black },
  h3: { size: 18, family: 'Inter', style: 'Bold', color: WIREFRAME_COLORS.darkGrey },
  body: { size: 14, family: 'Inter', style: 'Regular', color: WIREFRAME_COLORS.darkGrey },
  small: { size: 12, family: 'Inter', style: 'Regular', color: { r: 0.46, g: 0.46, b: 0.46 } },
  button: { size: 14, family: 'Inter', style: 'Bold', color: WIREFRAME_COLORS.white }
};

interface PaddingOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  vertical?: number;
  horizontal?: number;
}

interface SectionOptions {
  padding?: number | PaddingOptions;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  gap?: number;
  direction?: "VERTICAL" | "HORIZONTAL";
  fill?: 'white' | 'lightGrey' | 'midGrey' | 'darkGrey' | 'black' | string; // Allow HEX strings too
  cornerRadius?: number;
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
  stroke?: string;
  strokeWeight?: number;
  opacity?: number;
}

export async function createSection(name: string, width: number, options: SectionOptions): Promise<FrameNode> {
  if (!options) { options = {}; }
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = options.direction || "VERTICAL";
  
  frame.primaryAxisSizingMode = options.primaryAxisSizingMode || "AUTO";
  frame.counterAxisSizingMode = options.counterAxisSizingMode || "FIXED";
  
  if (frame.counterAxisSizingMode === 'FIXED') {
    frame.resize(width, frame.height);
  }
  
  // Robust Padding Handling
  let pt = 32, pb = 32, pl = 32, pr = 32;
  
  if (typeof options.padding === 'number') {
    pt = pb = pl = pr = options.padding;
  } else if (options.padding && typeof options.padding === 'object') {
    const p = options.padding;
    pt = p.top !== undefined ? p.top : (p.vertical !== undefined ? p.vertical : 32);
    pb = p.bottom !== undefined ? p.bottom : (p.vertical !== undefined ? p.vertical : 32);
    pl = p.left !== undefined ? p.left : (p.horizontal !== undefined ? p.horizontal : 32);
    pr = p.right !== undefined ? p.right : (p.horizontal !== undefined ? p.horizontal : 32);
  }

  // Override with individual properties if provided
  if (options.paddingTop !== undefined) pt = options.paddingTop;
  if (options.paddingBottom !== undefined) pb = options.paddingBottom;
  if (options.paddingLeft !== undefined) pl = options.paddingLeft;
  if (options.paddingRight !== undefined) pr = options.paddingRight;

  frame.paddingTop = pt;
  frame.paddingBottom = pb;
  frame.paddingLeft = pl;
  frame.paddingRight = pr;
  frame.itemSpacing = (options.gap !== undefined) ? options.gap : 16;
  
  const fillKey = options.fill || 'white';
  if (fillKey.startsWith('#')) {
    // Handle HEX
    const r = parseInt(fillKey.substring(1, 3), 16) / 255;
    const g = parseInt(fillKey.substring(3, 5), 16) / 255;
    const b = parseInt(fillKey.substring(5, 7), 16) / 255;
    frame.fills = [{ type: 'SOLID', color: { r, g, b }, opacity: options.opacity ?? 1 }];
  } else {
    const fillColor = (WIREFRAME_COLORS as any)[fillKey] || WIREFRAME_COLORS.white;
    frame.fills = [{ type: 'SOLID', color: fillColor, opacity: options.opacity ?? 1 }];
  }
  
  if (options.cornerRadius) {
    frame.cornerRadius = options.cornerRadius;
    frame.clipsContent = true;
  }

  if (options.stroke) {
    const strokeColor = options.stroke.startsWith('#') 
      ? {
          r: parseInt(options.stroke.substring(1, 3), 16) / 255,
          g: parseInt(options.stroke.substring(3, 5), 16) / 255,
          b: parseInt(options.stroke.substring(5, 7), 16) / 255
        }
      : WIREFRAME_COLORS.midGrey;
    frame.strokes = [{ type: 'SOLID', color: strokeColor }];
    frame.strokeWeight = options.strokeWeight || 1;
  }
  
  return frame;
}

export async function createTextLabel(content: string, preset: keyof typeof TYPOGRAPHY, options: { width?: number; align?: "LEFT" | "CENTER" | "RIGHT" }): Promise<TextNode> {
  if (!preset) { preset = 'body'; }
  if (!options) { options = {}; }
  const text = figma.createText();
  const style = TYPOGRAPHY[preset] || TYPOGRAPHY.body;
  
  text.fontName = { family: style.family, style: style.style };
  text.characters = String(content || '');
  text.fontSize = style.size;
  text.fills = [{ type: 'SOLID', color: style.color }];
  
  if (options.width) {
    text.resize(options.width, text.height);
    text.textAutoResize = 'HEIGHT';
  }
  
  if (options.align) {
    text.textAlignHorizontal = options.align;
  }
  
  return text;
}

export function createPlaceholderRect(width: number, height: number, label: string): FrameNode {
  if (!label) { label = ''; }
  const frame = figma.createFrame();
  frame.name = label ? ('Placeholder: ' + label) : 'Placeholder';
  frame.resize(width, height);
  frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.lightGrey }];
  // Use a simple label text instead of drawing lines (lines caused rendering issues)
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  return frame;
}

export function createImagePlaceholder(width: number, height: number, label: string): FrameNode {
  const frame = createPlaceholderRect(width, height, label || 'Image');
  // Darker tint for image placeholders
  frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.midGrey }];
  return frame;
}

export function createIconPlaceholder(size: number): EllipseNode {
  const ellipse = figma.createEllipse();
  ellipse.name = 'Icon Placeholder';
  ellipse.resize(size, size);
  ellipse.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.midGrey }];
  return ellipse;
}

export async function createAvatarPlaceholder(size: number, initials: string): Promise<FrameNode> {
  if (!initials) { initials = ''; }
  const frame = figma.createFrame();
  frame.name = 'Avatar';
  frame.resize(size, size);
  frame.cornerRadius = size / 2;
  frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.midGrey }];
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';

  if (initials) {
    const text = await createTextLabel(initials, 'small', {});
    text.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.white }];
    text.fontName = { family: 'Inter', style: 'Bold' };
    frame.appendChild(text);
  }

  return frame;
}

export async function createButton(label: string, options: { variant?: "primary" | "secondary" | "outline"; width?: number }): Promise<FrameNode> {
  if (!options) { options = {}; }
  const frame = figma.createFrame();
  frame.name = 'Button: ' + label;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingTop = 12; frame.paddingBottom = 12;
  frame.paddingLeft = 24; frame.paddingRight = 24;
  frame.cornerRadius = 8;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  
  const variant = options.variant || 'primary';
  
  if (options.width) {
    frame.primaryAxisSizingMode = 'FIXED';
    frame.resize(options.width, frame.height);
  }

  const text = await createTextLabel(label, 'button', {});
  
  if (variant === 'secondary') {
    frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.lightGrey }];
    text.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.darkGrey }];
  } else if (variant === 'outline') {
    frame.fills = [];
    frame.strokes = [{ type: 'SOLID', color: WIREFRAME_COLORS.midGrey }];
    frame.strokeWeight = 1;
    text.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.darkGrey }];
  } else {
    frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.darkGrey }];
    text.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.white }];
  }
  
  frame.appendChild(text);
  return frame;
}

export function createDivider(width: number): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = 'Divider';
  rect.resize(width, 1);
  rect.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.midGrey }];
  return rect;
}

export async function createSlideshowPlaceholder(width: number, height: number, slides: number): Promise<FrameNode> {
  const frame = createPlaceholderRect(width, height, 'Slideshow');
  frame.fills = [{ type: 'SOLID', color: WIREFRAME_COLORS.lightGrey }];
  
  const indicatorContainer = figma.createFrame();
  indicatorContainer.name = 'Indicators';
  indicatorContainer.layoutMode = 'HORIZONTAL';
  indicatorContainer.itemSpacing = 8;
  indicatorContainer.fills = [];
  indicatorContainer.counterAxisSizingMode = 'AUTO';
  indicatorContainer.primaryAxisSizingMode = 'AUTO';

  for (let i = 0; i < slides; i++) {
    const dot = figma.createEllipse();
    dot.resize(8, 8);
    dot.fills = [{ type: 'SOLID', color: i === 0 ? WIREFRAME_COLORS.darkGrey : WIREFRAME_COLORS.midGrey }];
    indicatorContainer.appendChild(dot);
  }

  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'MAX';
  frame.paddingBottom = 20;

  frame.appendChild(indicatorContainer);
  return frame;
}

/**
 * Creates an instance of a learned component.
 * This is dynamically called by the AI agent when it wants to use a scanned component.
 */
export async function createComponent(name: string, properties: Record<string, any>): Promise<InstanceNode> {
  // Global search in the entire document for the component or component set
  const component = figma.root.findOne(node => 
    (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') && node.name === name
  ) as ComponentNode | ComponentSetNode;

  if (!component) {
    throw new Error(`Component "${name}" not found. Bitte sicherstellen, dass die Komponente im Dokument vorhanden ist.`);
  }

  let instance: InstanceNode;
  if (component.type === 'COMPONENT_SET') {
    // For component sets, we need to find the right variant
    // This is a simplified version; in a real scenario we'd match properties to variant names
    instance = component.defaultVariant.createInstance();
  } else {
    instance = component.createInstance();
  }

  // Apply properties if they match the component's definitions
  if (properties) {
    for (const [propName, value] of Object.entries(properties)) {
      try {
        instance.setProperties({ [propName]: value });
      } catch (e) {
        console.warn(`Could not set property ${propName} on ${name}`);
      }
    }
  }

  return instance;
}
