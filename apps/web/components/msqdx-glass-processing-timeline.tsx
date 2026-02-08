"use client";

import { MsqdxProcessingTimeline } from "@msqdx/react";

export type MsqdxGlassProcessingTimelineProps = {
  activeStage?: string;
};

export const MsqdxGlassProcessingTimeline = ({
  activeStage,
}: MsqdxGlassProcessingTimelineProps) => (
  <MsqdxProcessingTimeline activeStage={activeStage} />
);
