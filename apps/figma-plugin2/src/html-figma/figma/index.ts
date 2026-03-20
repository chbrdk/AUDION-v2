import { LayerNode, PlainLayerNode } from '../types';
import { traverse, traverseAsync } from '../utils';
import { processLayer } from './processLayer';
import {
    finalizeFlexWrapRows,
    finalizeGridRows,
    finalizeNormalizeAutoLayoutChildren,
    applyAllPendingLayoutPositioning,
} from './apply-auto-layout';

interface LayerCbArgs {
    node: SceneNode;
    layer: LayerNode;
    parent: LayerNode | null;
}

type LayerJsonTree = PlainLayerNode & { children?: PlainLayerNode[] };

/** Post-order: children first, then grid rows → legacy flex wrap rows → AL child xy normalize. */
async function postOrderFinalizeLayout(layer: PlainLayerNode): Promise<void> {
    const tree = layer as LayerJsonTree;
    if (tree.children?.length) {
        for (const c of tree.children) {
            await postOrderFinalizeLayout(c);
        }
    }
    finalizeGridRows(layer);
    finalizeFlexWrapRows(layer);
    finalizeNormalizeAutoLayoutChildren(layer);
}

export async function addLayersToFrame(
    layers: PlainLayerNode[],
    baseFrame: PageNode | FrameNode,
    onLayerProcess?: (args: LayerCbArgs) => void
) {
    for (const rootLayer of layers) {
        await traverseAsync(rootLayer, async (layer, parent) => {
            try {
                const node = await processLayer(layer, parent, baseFrame);

                onLayerProcess?.({ node, layer, parent });
            } catch (err) {
                console.warn('Error on layer:', layer, err);
            }
        });
        await postOrderFinalizeLayout(rootLayer);
        applyAllPendingLayoutPositioning(rootLayer);
    }
}

export * from './getFont';
export * from './dropOffset';
