import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsApi } from "@/services/assets.service";
import type {
  CreatePlantRequest,
  CreateAreaRequest,
  CreateLineRequest,
  CreateAssetRequest,
} from "@/types/api";

export function usePlants() {
  return useQuery({
    queryKey: ["plants"],
    queryFn: () => assetsApi.listPlants(),
  });
}

export function usePlant(id: string) {
  return useQuery({
    queryKey: ["plants", id],
    queryFn: () => assetsApi.getPlant(id),
    enabled: !!id,
  });
}

export function useAreas(plantId: string) {
  return useQuery({
    queryKey: ["areas", plantId],
    queryFn: () => assetsApi.listAreas(plantId),
    enabled: !!plantId,
  });
}

export function useLines(areaId: string) {
  return useQuery({
    queryKey: ["lines", areaId],
    queryFn: () => assetsApi.listLines(areaId),
    enabled: !!areaId,
  });
}

export function useAssets(lineId: string) {
  return useQuery({
    queryKey: ["assets", lineId],
    queryFn: () => assetsApi.listAssets(lineId),
    enabled: !!lineId,
  });
}

export function useCreatePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlantRequest) => assetsApi.createPlant(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plants"] }),
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantId, data }: { plantId: string; data: CreateAreaRequest }) =>
      assetsApi.createArea(plantId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useCreateLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ areaId, data }: { areaId: string; data: CreateLineRequest }) =>
      assetsApi.createLine(areaId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lines"] }),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: CreateAssetRequest }) =>
      assetsApi.createAsset(lineId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}
