type ClearanceRange = {
  field: 'height' | 'width' | 'depth';
  required: boolean;
};

type ApplianceFitRule = ClearanceRange[];

export const ApplianceFitRules: Record<string, ApplianceFitRule> = {
  'Wall Oven': [
    { field: 'height', required: true },
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  'Dishwasher': [
    { field: 'height', required: true },
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  'Refrigerator': [
    { field: 'height', required: true },
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  'Washer': [
    { field: 'height', required: true },
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  'Cooktop': [
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  'Over-the-Range Microwave': [
    { field: 'width', required: true },
  ],
  'Telescopic Downdraft': [
    { field: 'depth', required: true },
  ],
  'Warming Drawer': [
    { field: 'height', required: true },
    { field: 'width', required: true },
  ],
  'Icemaker': [
    { field: 'height', required: true },
    { field: 'width', required: true },
    { field: 'depth', required: true },
  ],
  // Add more appliance types as needed
};
