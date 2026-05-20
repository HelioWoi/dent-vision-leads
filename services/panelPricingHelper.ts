import { DentAnalysisResponse, MaterialType, VehicleType } from '../types';

export const calculatePanelPricing = async (
  result: DentAnalysisResponse,
  _material: MaterialType,
  _vehicleType: VehicleType
): Promise<DentAnalysisResponse> => {
  return result;
};
