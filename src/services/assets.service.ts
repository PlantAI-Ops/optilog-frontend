import { api } from "@/lib/api-client";
import type {
  AssetResponse,
  CreateAssetRequest,
  PlantResponse,
  CreatePlantRequest,
  AreaResponse,
  CreateAreaRequest,
  LineResponse,
  CreateLineRequest,
} from "@/types/api";

export const assetsApi = {
  // Plants
  listPlants(): Promise<PlantResponse[]> {
    return api.get("/assets/plants");
  },

  getPlant(id: string): Promise<PlantResponse> {
    return api.get(`/assets/plants/${id}`);
  },

  createPlant(data: CreatePlantRequest): Promise<PlantResponse> {
    return api.post("/assets/plants", data);
  },

  // Areas
  listAreas(plantId: string): Promise<AreaResponse[]> {
    return api.get(`/assets/plants/${plantId}/areas`);
  },

  createArea(plantId: string, data: CreateAreaRequest): Promise<AreaResponse> {
    return api.post(`/assets/plants/${plantId}/areas`, data);
  },

  // Lines
  listLines(areaId: string): Promise<LineResponse[]> {
    return api.get(`/assets/areas/${areaId}/lines`);
  },

  createLine(areaId: string, data: CreateLineRequest): Promise<LineResponse> {
    return api.post(`/assets/areas/${areaId}/lines`, data);
  },

  // Assets
  listAssets(lineId: string): Promise<AssetResponse[]> {
    return api.get(`/assets/lines/${lineId}/assets`);
  },

  createAsset(lineId: string, data: CreateAssetRequest): Promise<AssetResponse> {
    return api.post(`/assets/lines/${lineId}/assets`, data);
  },

  getAsset(id: string): Promise<AssetResponse> {
    return api.get(`/assets/${id}`);
  },
};
