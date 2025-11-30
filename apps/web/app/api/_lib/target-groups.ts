import { getPersonaBackendBase } from "./backend";

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
    
    // Use public URL for client-side requests
    const baseUrl = getPersonaBackendBase({ preferPublic: true });
    const url = `${baseUrl}/target-groups${searchParams.toString() ? `?${searchParams}` : ""}`;
    console.log("Fetching target groups from:", url); // Debug log
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    const data = await response.json();
    console.log("Target groups response:", data); // Debug log
    return data;
  },

  getTargetGroup: async (id: string): Promise<TargetGroupResponse> => {
    const response = await fetch(`${getPersonaBackendBase()}/target-groups/${id}`);
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },
};

