import { buildApiUrl } from "./backend";

export interface TargetGroupResponse {
  id: string;
  name: string;
  description?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  persona_count?: number;
  knowledge_entry_count?: number;
}

export interface TargetGroupListResponse {
  items: TargetGroupResponse[];
  total: number;
  page: number;
  page_size: number;
}

export const targetGroupsApi = {
  listTargetGroups: async (params?: {
    project_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<TargetGroupListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    
    const url = buildApiUrl(`/api/target-groups${searchParams.toString() ? `?${searchParams}` : ""}`);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    const data = await response.json();
    return data;
  },

  getTargetGroup: async (id: string): Promise<TargetGroupResponse> => {
    const response = await fetch(buildApiUrl(`/api/target-groups/${id}`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },
};
