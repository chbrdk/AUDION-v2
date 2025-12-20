"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as d3 from "d3";
import type {
  KnowledgeChunk,
  KnowledgeCluster,
  ClusterResult,
  SimilarChunk,
} from "@msqdx-glass/types";
import {
  fetchTargetGroupClusters,
  fetchSimilarChunks,
  type ClusterOptions,
} from "../app/api/_lib/target-group";
import { MaterialSymbol } from "./material-symbol";

interface KnowledgeExplorerProps {
  targetGroupId: string;
}

export function MsqdxGlassKnowledgeExplorer({ targetGroupId }: KnowledgeExplorerProps) {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [clusters, setClusters] = useState<KnowledgeCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<KnowledgeChunk | null>(null);
  const [similarChunks, setSimilarChunks] = useState<SimilarChunk[]>([]);
  const [viewMode, setViewMode] = useState<"scatter" | "list">("scatter");
  const [nClusters, setNClusters] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const loadClusters = useCallback(async () => {
    if (!targetGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const options: ClusterOptions = {
        method: "kmeans",
        nClusters,
        limit: 1000,
      };
      const data = await fetchTargetGroupClusters(targetGroupId, options);

      if (!data) {
        throw new Error("No data received from API");
      }

      // Handle both snake_case and camelCase from backend
      const coordinates2d = (data.coordinates2d ?? (data as any).coordinates_2d) || [];
      const clusterLabels = (data.clusterLabels ?? (data as any).cluster_labels) || [];
      const chunks = data.chunks || [];
      const clusters = data.clusters || [];

      // Ensure arrays are actually arrays
      if (!Array.isArray(coordinates2d)) {
        console.warn("coordinates2d is not an array:", coordinates2d);
      }
      if (!Array.isArray(clusterLabels)) {
        console.warn("clusterLabels is not an array:", clusterLabels);
      }
      if (!Array.isArray(chunks)) {
        console.warn("chunks is not an array:", chunks);
      }

      // Map coordinates and cluster labels to chunks
      // Note: coordinates_2d may have fewer items than chunks if some chunks don't have embeddings
      const chunksWithCoords = chunks.map((chunk: any, idx: number) => {
        // Chunks already have x, y, and cluster_id from backend if they were included
        // But we'll use coordinates_2d and cluster_labels if available
        const coord = Array.isArray(coordinates2d) && coordinates2d[idx] ? coordinates2d[idx] : null;
        const clusterId = Array.isArray(clusterLabels) && clusterLabels[idx] !== undefined ? clusterLabels[idx] : (chunk.cluster_id ?? chunk.clusterId ?? null);
        
        return {
          ...chunk,
          x: chunk.x ?? (Array.isArray(coord) && coord.length > 0 ? coord[0] : null),
          y: chunk.y ?? (Array.isArray(coord) && coord.length > 1 ? coord[1] : null),
          clusterId: clusterId ?? null,
        };
      });

      setChunks(chunksWithCoords);
      setClusters(clusters);
    } catch (error) {
      console.error("Failed to load clusters", error);
      setError(error instanceof Error ? error.message : "Failed to load clusters");
    } finally {
      setLoading(false);
    }
  }, [targetGroupId, nClusters]);

  useEffect(() => {
    if (targetGroupId) {
      void loadClusters();
    }
  }, [targetGroupId, loadClusters]);

  const handleChunkClick = async (chunk: KnowledgeChunk) => {
    setSelectedChunk(chunk);
    try {
      const similar = await fetchSimilarChunks(targetGroupId, chunk.id, 10);
      setSimilarChunks(similar);
    } catch (error) {
      console.error("Failed to load similar chunks", error);
      setSimilarChunks([]);
    }
  };

  const handleCloseDetail = () => {
    setSelectedChunk(null);
    setSimilarChunks([]);
  };

  // Always render the component, even if empty
  if (!targetGroupId) {
    return (
      <div className="msqdx-glass-knowledge-explorer">
        <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Knowledge Explorer
        </h3>
        <p className="msqdx-glass-empty">Please select a Target Group to explore knowledge.</p>
      </div>
    );
  }

  return (
    <div className="msqdx-glass-knowledge-explorer">
      <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Knowledge Explorer
      </h3>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
          Clusters:
          <input
            type="number"
            min="2"
            max="50"
            value={nClusters}
            onChange={(e) => setNClusters(Math.max(2, Math.min(50, parseInt(e.target.value) || 10)))}
            className="msqdx-glass-field"
            style={{ width: "60px", padding: "0.375rem 0.625rem", fontSize: "0.8125rem", border: "1px solid var(--color-theme-accent)", borderRadius: "8px" }}
          />
        </label>
        <button
          className="msqdx-glass-button --ghost"
          onClick={loadClusters}
          disabled={loading}
          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
        >
          <MaterialSymbol icon="refresh" fontSize={14} />
          {loading ? "Loading..." : "Re-cluster"}
        </button>
        {chunks.length > 0 && (
          <button
            className="msqdx-glass-button --ghost"
            onClick={() => setViewMode(viewMode === "scatter" ? "list" : "scatter")}
            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
          >
            <MaterialSymbol
              icon={viewMode === "scatter" ? "view_list" : "scatter_plot"}
              fontSize={14}
            />
            {viewMode === "scatter" ? "List View" : "Scatter Plot"}
          </button>
        )}
      </div>

      {error && (
        <div className="msqdx-glass-error" style={{ padding: "0.75rem", marginBottom: "1rem", borderRadius: "0", border: "1px solid var(--color-secondary-dx-pink)", backgroundColor: "var(--color-secondary-dx-pink-tint)" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <p className="msqdx-glass-empty">Loading chunks and generating clusters...</p>
      )}

      {!loading && !error && chunks.length === 0 && (
        <p className="msqdx-glass-empty">No chunks available for clustering. Upload documents to explore knowledge.</p>
      )}

      {!loading && !error && chunks.length > 0 && viewMode === "scatter" && (
        <KnowledgeScatterPlot
          chunks={chunks}
          clusters={clusters}
          onChunkClick={handleChunkClick}
          selectedChunk={selectedChunk}
        />
      )}

      {!loading && !error && chunks.length > 0 && viewMode === "list" && (
        <KnowledgeListView
          chunks={chunks}
          clusters={clusters}
          onChunkClick={handleChunkClick}
          selectedChunk={selectedChunk}
        />
      )}

      {selectedChunk && (
        <ChunkDetailPanel
          chunk={selectedChunk}
          similarChunks={similarChunks}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

// Scatter Plot Component using D3.js
interface KnowledgeScatterPlotProps {
  chunks: KnowledgeChunk[];
  clusters: KnowledgeCluster[];
  onChunkClick: (chunk: KnowledgeChunk) => void;
  selectedChunk: KnowledgeChunk | null;
}

function KnowledgeScatterPlot({
  chunks,
  clusters,
  onChunkClick,
  selectedChunk,
}: KnowledgeScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || chunks.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get container width dynamically
    const container = svgRef.current.parentElement;
    const containerWidth = container ? container.clientWidth : 1000;
    const width = containerWidth; // Use full container width
    const height = 700;
    const margin = { top: 20, right: 120, bottom: 20, left: 20 }; // Reduced right margin for legend
    
    // Update SVG width
    svg.attr("width", width);

    // Filter chunks with coordinates
    const chunksWithCoords = chunks.filter((chunk) => chunk.x !== null && chunk.y !== null);

    if (chunksWithCoords.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .text("No chunks with coordinates available");
      return;
    }

    const xValues = chunksWithCoords.map((d) => d.x!);
    const yValues = chunksWithCoords.map((d) => d.y!);

    const xExtent = d3.extent(xValues) as [number, number];
    const yExtent = d3.extent(yValues) as [number, number];

    // Add padding
    const xRange = xExtent[1] - xExtent[0] || 1;
    const yRange = yExtent[1] - yExtent[0] || 1;
    xExtent[0] -= xRange * 0.1;
    xExtent[1] += xRange * 0.1;
    yExtent[0] -= yRange * 0.1;
    yExtent[1] += yRange * 0.1;

    const xScale = d3.scaleLinear().domain(xExtent).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain(yExtent).range([height - margin.bottom, margin.top]);

    // Color scale for clusters (excluding -1 for noise)
    const clusterIds = Array.from(new Set(chunksWithCoords.map((c) => c.clusterId).filter((id) => id !== null && id !== -1))).sort((a, b) => a! - b!);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(clusterIds.map(String));

    // Draw points
    svg
      .selectAll<SVGCircleElement, KnowledgeChunk>("circle")
      .data(chunksWithCoords)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.x!))
      .attr("cy", (d) => yScale(d.y!))
      .attr("r", (d) => (selectedChunk?.id === d.id ? 8 : 5))
      .attr("fill", (d) => {
        if (d.clusterId === null || d.clusterId === -1) return "#999";
        return colorScale(String(d.clusterId));
      })
      .attr("opacity", 0.7)
      .attr("stroke", (d) => (selectedChunk?.id === d.id ? "#000" : "none"))
      .attr("stroke-width", selectedChunk ? 2 : 0)
      .style("cursor", "pointer")
      .on("click", (_, d) => onChunkClick(d))
      .append("title")
      .text((d) => d.content.substring(0, 100));

    // Axes removed

    // Add cluster legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - margin.right - 140},${margin.top})`);

    // Add noise cluster if present
    const hasNoise = chunksWithCoords.some((c) => c.clusterId === -1);
    if (hasNoise) {
      const noiseRow = legend.append("g").attr("transform", `translate(0,0)`);
      noiseRow
        .append("circle")
        .attr("r", 5)
        .attr("fill", "#999");
      noiseRow
        .append("text")
        .attr("x", 10)
        .attr("y", 5)
        .text("Other (unclustered)")
        .style("font-size", "12px");
    }

    clusters.forEach((cluster, idx) => {
      const legendRow = legend.append("g").attr("transform", `translate(0,${(hasNoise ? 20 : 0) + idx * 20})`);
      legendRow.append("circle").attr("r", 5).attr("fill", colorScale(String(cluster.id)));
      legendRow
        .append("text")
        .attr("x", 10)
        .attr("y", 5)
        .text(`${cluster.topic} (${cluster.size})`)
        .style("font-size", "12px");
    });
  }, [chunks, clusters, selectedChunk, onChunkClick]);

  return (
    <div style={{ marginBottom: "1rem", width: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
      <svg ref={svgRef} style={{ borderRadius: "0", width: "100%", height: "700px", maxWidth: "100%", boxSizing: "border-box" }} />
    </div>
  );
}

// List View Component
interface KnowledgeListViewProps {
  chunks: KnowledgeChunk[];
  clusters: KnowledgeCluster[];
  onChunkClick: (chunk: KnowledgeChunk) => void;
  selectedChunk: KnowledgeChunk | null;
}

function KnowledgeListView({
  chunks,
  clusters,
  onChunkClick,
  selectedChunk,
}: KnowledgeListViewProps) {
  // Group chunks by cluster
  const chunksByCluster = clusters.map((cluster) => ({
    ...cluster,
    chunks: chunks.filter((c) => c.clusterId === cluster.id),
  }));

  // Handle unclustered chunks
  const unclusteredChunks = chunks.filter((c) => c.clusterId === null || c.clusterId === -1);
  if (unclusteredChunks.length > 0) {
    chunksByCluster.push({
      id: -1,
      topic: "Other",
      description: "Unclustered chunks",
      size: unclusteredChunks.length,
      chunkIds: unclusteredChunks.map((c) => c.id),
      chunks: unclusteredChunks,
    });
  }

  return (
    <div className="msqdx-glass-knowledge-list">
      {chunksByCluster.map((cluster) => (
        <div key={cluster.id} className="msqdx-glass-detail__section">
          <h4 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {cluster.topic} ({cluster.size})
          </h4>
          <div className="msqdx-glass-list">
            {cluster.chunks.slice(0, 12).map((chunk) => (
              <div
                key={chunk.id}
                className={`msqdx-glass-list-item ${selectedChunk?.id === chunk.id ? "is-active" : ""}`}
                onClick={() => onChunkClick(chunk)}
              >
                <div className="msqdx-glass-list-item__row">
                  <strong>{chunk.content.substring(0, 100)}{chunk.content.length > 100 ? "..." : ""}</strong>
                  <span className="msqdx-glass-chip --draft">
                    {(chunk.relevanceScore ?? 0).toFixed(2)}
                  </span>
                </div>
                {chunk.documentFilename && (
                  <p className="msqdx-glass-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", margin: 0 }}>
                    {chunk.documentFilename || "Unknown document"}
                  </p>
                )}
              </div>
            ))}
            {cluster.chunks.length > 12 && (
              <p className="msqdx-glass-muted" style={{ fontSize: "0.8125rem", textAlign: "center", padding: "0.75rem", margin: 0 }}>
                ... and {cluster.chunks.length - 12} more chunks
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Detail Panel Component
interface ChunkDetailPanelProps {
  chunk: KnowledgeChunk;
  similarChunks: SimilarChunk[];
  onClose: () => void;
}

function ChunkDetailPanel({ chunk, similarChunks, onClose }: ChunkDetailPanelProps) {
  return (
    <div
      className="msqdx-glass-chunk-detail-panel"
      style={{
        position: "fixed",
        right: "0",
        top: "0",
        bottom: "0",
        width: "500px",
        backgroundColor: "var(--color-primary-white)",
        borderLeft: "1px solid var(--color-theme-accent)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        className="msqdx-glass-chunk-detail-panel__header"
        style={{
          padding: "1rem",
          borderBottom: "1px solid var(--color-theme-accent)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h4 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 100, textTransform: "uppercase", letterSpacing: "0.05em" }}>Chunk Details</h4>
        <button
          className="msqdx-glass-button --ghost"
          onClick={onClose}
          style={{ padding: "0.375rem", fontSize: "0.75rem" }}
        >
          <MaterialSymbol icon="close" fontSize={18} />
        </button>
      </div>
      <div
        className="msqdx-glass-chunk-detail-panel__content"
        style={{
          padding: "1rem",
          overflowY: "auto",
          flex: 1,
        }}
      >
        <div className="msqdx-glass-detail__section" style={{ marginBottom: "1rem" }}>
          <dl className="msqdx-glass-meta-grid">
            <div>
              <dt>Document</dt>
              <dd>{chunk.documentFilename || "Unknown"}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Score</dt>
              <dd>{(chunk.relevanceScore ?? 0).toFixed(2)}</dd>
            </div>
            {chunk.clusterId !== null && chunk.clusterId !== -1 && (
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Cluster</dt>
                <dd>{chunk.clusterId}</dd>
              </div>
            )}
          </dl>
        </div>
        <div
          className="msqdx-glass-chunk-full-content"
          style={{
            padding: "1rem",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: "0",
            marginBottom: "1rem",
            whiteSpace: "pre-wrap",
            fontSize: "0.875rem",
            lineHeight: "1.6",
          }}
        >
          <p style={{ margin: 0 }}>{chunk.content}</p>
        </div>
        {similarChunks.length > 0 && (
          <div className="msqdx-glass-similar-chunks">
            <h5 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Similar Chunks ({similarChunks.length})
            </h5>
            <div className="msqdx-glass-list">
              {similarChunks.map((similar) => (
                <div
                  key={similar.id}
                  className="msqdx-glass-list-item"
                >
                  <div className="msqdx-glass-list-item__row">
                    <strong>{similar.content.substring(0, 100)}{similar.content.length > 100 ? "..." : ""}</strong>
                    <span className="msqdx-glass-chip --draft">
                      {(similar.similarity || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

