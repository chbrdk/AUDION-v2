import { getImageFills } from "../utils";
import { processImages } from "./images";
import { getMatchingFont } from "./getFont";
import { assign } from "./helpers";
import { fitTextWidthForMaxHeight } from "./fit-text-width";
import { LayerNode, PlainLayerNode, WithRef } from "../types";
import {
    peelFrameLayoutMeta,
    peelDeferredLayoutPositioning,
    getFrameLayoutMeta,
    clearFrameLayoutMeta,
    applyAutoLayoutToFrame,
    layerJsonSubtreeHasRotation,
    type TextLayoutHintPayload,
} from "./apply-auto-layout";

const processDefaultElement = (layer: LayerNode, node: SceneNode): SceneNode => {
    node.x = layer.x as number;
    node.y = layer.y as number;
    (node as { resize(w: number, h: number): void }).resize(layer.width || 1, layer.height || 1);
    assign(node, layer);

    if (node.type === "FRAME") {
        const meta = getFrameLayoutMeta(layer as Record<string, unknown>);
        if (meta?.figmaAutoLayout) {
            if (layerJsonSubtreeHasRotation(layer as Record<string, unknown>)) {
                clearFrameLayoutMeta(layer as Record<string, unknown>);
            } else {
                const multiFlexRow =
                    Array.isArray(meta.figmaFlexWrapRows) && meta.figmaFlexWrapRows.length > 1;
                const multiGridRow =
                    Array.isArray(meta.figmaGridRows) && meta.figmaGridRows.length > 1;
                const deferStructure = multiFlexRow || multiGridRow;
                applyAutoLayoutToFrame(node as FrameNode, meta.figmaAutoLayout, {
                    deferPrimaryLayout: deferStructure,
                });
                if (!deferStructure) {
                    clearFrameLayoutMeta(layer as Record<string, unknown>);
                }
            }
        }
    }

    return node;
};

const createNodeFromLayer = (layer: LayerNode) => {
    if (layer.type === 'FRAME' || layer.type === 'GROUP') {
        return figma.createFrame();
    }

    if (layer.type === 'SVG' && layer.svg) {
        return figma.createNodeFromSvg(layer.svg);
    }

    if (layer.type === 'RECTANGLE') {
        return figma.createRectangle();
    }

    if (layer.type === 'TEXT') {
        return figma.createText();
    }

    if (layer.type === 'COMPONENT') {
        return figma.createComponent();
    }
};

const SIMPLE_TYPES = ['FRAME', 'GROUP', 'SVG', 'RECTANGLE', 'COMPONENT'];

export const processLayer = async (
    layer: PlainLayerNode,
    parent: WithRef<LayerNode> | null,
    baseFrame: PageNode | FrameNode
) => {
    const parentFrame = (parent?.ref as FrameNode) || baseFrame;

    if (typeof layer.x !== 'number' || typeof layer.y !== 'number') {
        throw Error('Layer coords not defined');
    }

    const node = createNodeFromLayer(layer);

    if (!node) {
        throw Error(`${layer.type} not implemented`);
    }

    if (SIMPLE_TYPES.includes(layer.type as string)) {
        peelFrameLayoutMeta(layer as Record<string, unknown>);
        peelDeferredLayoutPositioning(layer as Record<string, unknown>);
        await processImages(layer);
        parentFrame.appendChild(processDefaultElement(layer, node));
    }
    // @ts-expect-error
    layer.ref = node;

    if (layer.type === 'TEXT') {
        const text = node as TextNode;
        const textRaw = layer as Record<string, unknown>;
        const textHint = textRaw.textLayoutHint as TextLayoutHintPayload | undefined;
        delete textRaw.textLayoutHint;

        if (layer.fontFamily) {
            text.fontName = await getMatchingFont(layer.fontFamily);

            delete layer.fontFamily;
        }

        await processImages(layer);

        peelDeferredLayoutPositioning(layer as Record<string, unknown>);
        assign(text, layer);
        text.resize(layer.width || 1, layer.height || 1);

        if (textHint?.textAutoResize) {
            text.textAutoResize = textHint.textAutoResize;
            if (
                textHint.applyEllipsis &&
                text.characters &&
                !/\u2026|…$/.test(text.characters)
            ) {
                text.characters = text.characters.replace(/\s+$/, "") + "\u2026";
            }
            if (
                textHint.maxLines &&
                textHint.maxLines > 0 &&
                text.textAutoResize === "TRUNCATE" &&
                typeof layer.height === "number"
            ) {
                try {
                    text.resize(layer.width || 1, layer.height);
                } catch (_) {
                    /* ignore */
                }
            }
        } else {
            text.textAutoResize = 'HEIGHT';
        }

        if (layer.lineHeight) {
            text.lineHeight = layer.lineHeight;
        }

        if (
            text.textAutoResize === "HEIGHT" &&
            typeof layer.height === "number" &&
            text.height > layer.height + 1
        ) {
            fitTextWidthForMaxHeight(
                (w) => {
                    try {
                        text.resize(w, text.height);
                    } catch (err) {
                        console.warn("[html-figma] Error resizing text while fitting height:", err);
                    }
                    return text.height;
                },
                layer.width || 1,
                layer.height,
                { maxWidth: 8192, heightTolerance: 1.5, maxOuterIterations: 80 }
            );
        }

        parentFrame.appendChild(text);
    }

    return node;
};
